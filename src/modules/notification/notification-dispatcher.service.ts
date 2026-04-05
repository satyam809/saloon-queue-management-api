import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannel, NotificationPriority } from '@common/enums/notification.enum';
import { Notification } from './entities/notification.entity';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';
import { InAppChannelAdapter } from './channels/in-app.channel';
import { EmailChannelAdapter } from './channels/email.channel';
import { SmsChannelAdapter } from './channels/sms.channel';
import { PushChannelAdapter } from './channels/push.channel';
import type { INotificationChannel } from './channels/notification-channel.interface';

/**
 * Central dispatch hub.
 *
 * Typical call site (e.g. QueueService):
 *   await this.dispatcher.dispatch({
 *     userId:            entry.customerId,
 *     type:              NotificationType.QUEUE_CALLED,
 *     data:              { salonName: salon.name, tokenNumber: entry.tokenNumber },
 *     relatedEntityType: 'queue_entry',
 *     relatedEntityId:   entry.id,
 *     priority:          NotificationPriority.URGENT,
 *   });
 *
 * The dispatcher:
 *   1. Resolves which channels to use (all by default, or forced via dto.channel).
 *   2. Checks the user's per-channel preference (opt-out model).
 *   3. Looks up the active template for (type × channel).
 *   4. Renders title + body by interpolating dto.data.
 *   5. Persists the Notification row.
 *   6. Calls the channel adapter's send().
 *   7. Marks sentAt on success.
 *
 * All channels are dispatched concurrently via Promise.allSettled so a failure
 * on one channel does not block the others.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly channelAdapters: Map<NotificationChannel, INotificationChannel>;

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly templateService: NotificationTemplateService,
    private readonly prefService: NotificationPreferenceService,
    inApp:  InAppChannelAdapter,
    email:  EmailChannelAdapter,
    sms:    SmsChannelAdapter,
    push:   PushChannelAdapter,
  ) {
    this.channelAdapters = new Map<NotificationChannel, INotificationChannel>([
      [NotificationChannel.IN_APP, inApp],
      [NotificationChannel.EMAIL,  email],
      [NotificationChannel.SMS,    sms],
      [NotificationChannel.PUSH,   push],
    ]);
  }

  // ─── Dispatch single user ─────────────────────────────────────────────────

  async dispatch(dto: DispatchNotificationDto): Promise<void> {
    const channels = dto.channel
      ? [dto.channel]
      : Object.values(NotificationChannel);

    // Load all preferences in one query instead of N per-channel hits
    const prefMap = await this.prefService.getPreferenceMap(dto.userId);

    await Promise.allSettled(
      channels.map((channel) =>
        this.dispatchToChannel(dto, channel, prefMap),
      ),
    );
  }

  // ─── Dispatch to multiple users ───────────────────────────────────────────

  /**
   * Broadcast the same notification to many users.
   * Each user gets their own preference check and DB row(s).
   */
  async dispatchToMany(
    userIds: string[],
    dto: Omit<DispatchNotificationDto, 'userId'>,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((userId) => this.dispatch({ ...dto, userId })),
    );
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async dispatchToChannel(
    dto: DispatchNotificationDto,
    channel: NotificationChannel,
    prefMap: Map<string, boolean>,
  ): Promise<void> {
    try {
      // 1. Check preference (default: enabled when no row exists)
      const isEnabled = prefMap.get(`${dto.type}:${channel}`) ?? true;
      if (!isEnabled) return;

      // 2. Look up active template
      const template = await this.templateService.findActive(dto.type, channel);
      if (!template) return; // no template = channel not configured for this type

      // 3. Render
      const title = this.templateService.render(template.titleTemplate, dto.data);
      const body  = this.templateService.render(template.bodyTemplate,  dto.data);

      // 4. Persist notification row
      const notification = await this.notifRepo.save(
        this.notifRepo.create({
          userId:            dto.userId,
          type:              dto.type,
          channel,
          title,
          body,
          priority:          dto.priority ?? NotificationPriority.NORMAL,
          relatedEntityType: dto.relatedEntityType ?? null,
          relatedEntityId:   dto.relatedEntityId   ?? null,
          metadata:          dto.metadata          ?? null,
        }),
      );

      // 5. Send via adapter
      const adapter = this.channelAdapters.get(channel);
      if (adapter) {
        await adapter.send(notification);
        // 6. Mark as sent (delivery confirmed by adapter)
        await this.notifRepo.update(notification.id, { sentAt: new Date() });
      }
    } catch (err) {
      // Never let one channel error propagate — log and continue
      this.logger.error(
        `Dispatch failed — userId=${dto.userId} type=${dto.type} channel=${channel}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
