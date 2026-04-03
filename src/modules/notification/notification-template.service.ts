import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';
import { NotificationTemplate } from './entities/notification-template.entity';
import { UpsertNotificationTemplateDto } from './dto/notification-template.dto';

// ─── Default seed templates ───────────────────────────────────────────────────
// Variables: {{userName}}, {{salonName}}, {{tokenNumber}}, {{date}}, {{time}},
//            {{amount}}, {{currency}}, {{title}}, {{body}}

const DEFAULT_TEMPLATES: Omit<UpsertNotificationTemplateDto, 'isActive'>[] = [
  // ─── Queue ──────────────────────────────────────────────────────────────────
  {
    type:          NotificationType.QUEUE_JOINED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Joined the queue at {{salonName}}',
    bodyTemplate:  'You\'ve joined the queue. Your token number is #{{tokenNumber}}. We\'ll notify you when it\'s your turn.',
  },
  {
    type:          NotificationType.QUEUE_CALLED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'It\'s Your Turn! — {{salonName}}',
    bodyTemplate:  'Token #{{tokenNumber}} is now being called. Please proceed to the counter.',
  },
  {
    type:          NotificationType.QUEUE_CALLED,
    channel:       NotificationChannel.SMS,
    titleTemplate: 'Your Turn',
    bodyTemplate:  '{{salonName}}: Token #{{tokenNumber}} is now ready. Please come in.',
  },
  {
    type:          NotificationType.QUEUE_CALLED,
    channel:       NotificationChannel.PUSH,
    titleTemplate: 'It\'s Your Turn! — {{salonName}}',
    bodyTemplate:  'Token #{{tokenNumber}} is now being called. Please proceed.',
  },

  // ─── Appointment ────────────────────────────────────────────────────────────
  {
    type:          NotificationType.APPOINTMENT_CONFIRMED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Appointment Confirmed — {{salonName}}',
    bodyTemplate:  'Your appointment on {{date}} at {{time}} has been confirmed. See you soon!',
  },
  {
    type:          NotificationType.APPOINTMENT_CONFIRMED,
    channel:       NotificationChannel.EMAIL,
    titleTemplate: 'Appointment Confirmed at {{salonName}}',
    bodyTemplate:  'Hi {{userName}}, your appointment at {{salonName}} on {{date}} at {{time}} is confirmed.',
  },
  {
    type:          NotificationType.APPOINTMENT_REMINDER,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Appointment Tomorrow — {{salonName}}',
    bodyTemplate:  'Reminder: your appointment at {{salonName}} is tomorrow at {{time}}.',
  },
  {
    type:          NotificationType.APPOINTMENT_REMINDER,
    channel:       NotificationChannel.SMS,
    titleTemplate: 'Appointment Reminder',
    bodyTemplate:  'Reminder: Appt at {{salonName}} tomorrow at {{time}}. Reply STOP to opt out.',
  },
  {
    type:          NotificationType.APPOINTMENT_CANCELLED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Appointment Cancelled — {{salonName}}',
    bodyTemplate:  'Your appointment at {{salonName}} on {{date}} has been cancelled.',
  },
  {
    type:          NotificationType.APPOINTMENT_CANCELLED,
    channel:       NotificationChannel.EMAIL,
    titleTemplate: 'Appointment Cancelled at {{salonName}}',
    bodyTemplate:  'Hi {{userName}}, your appointment at {{salonName}} on {{date}} at {{time}} has been cancelled.',
  },

  // ─── Payment ────────────────────────────────────────────────────────────────
  {
    type:          NotificationType.PAYMENT_RECEIVED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Payment Received — {{salonName}}',
    bodyTemplate:  'Payment of {{amount}} {{currency}} has been received. Thank you!',
  },
  {
    type:          NotificationType.PAYMENT_REFUNDED,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: 'Refund Processed',
    bodyTemplate:  'A refund of {{amount}} {{currency}} for your visit to {{salonName}} has been processed.',
  },

  // ─── Review ─────────────────────────────────────────────────────────────────
  {
    type:          NotificationType.REVIEW_REPLY,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: '{{salonName}} Replied to Your Review',
    bodyTemplate:  '{{salonName}} has replied to your review. Tap to see their response.',
  },

  // ─── General ────────────────────────────────────────────────────────────────
  {
    type:          NotificationType.GENERAL,
    channel:       NotificationChannel.IN_APP,
    titleTemplate: '{{title}}',
    bodyTemplate:  '{{body}}',
  },
];

@Injectable()
export class NotificationTemplateService implements OnModuleInit {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  findAll(): Promise<NotificationTemplate[]> {
    return this.templateRepo.find({ order: { type: 'ASC', channel: 'ASC' } });
  }

  findActive(type: NotificationType, channel: NotificationChannel): Promise<NotificationTemplate | null> {
    return this.templateRepo.findOne({ where: { type, channel, isActive: true } });
  }

  async upsert(dto: UpsertNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.templateRepo.findOne({
      where: { type: dto.type, channel: dto.channel },
    });

    if (existing) {
      Object.assign(existing, dto);
      return this.templateRepo.save(existing);
    }

    return this.templateRepo.save(
      this.templateRepo.create({ ...dto, isActive: dto.isActive ?? true }),
    );
  }

  async toggleActive(id: string, isActive: boolean): Promise<NotificationTemplate> {
    await this.templateRepo.update(id, { isActive });
    return this.templateRepo.findOneOrFail({ where: { id } });
  }

  // ─── Template rendering ────────────────────────────────────────────────────

  /**
   * Interpolate {{variable}} placeholders in a template string.
   * Unknown variables are left as-is (no crash on missing keys).
   */
  render(template: string, data: Record<string, string | number> = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      data[key] !== undefined ? String(data[key]) : `{{${key}}}`,
    );
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  async seedDefaults(): Promise<void> {
    const existing = await this.templateRepo.count();
    if (existing > 0) return; // Only seed on a fresh installation

    this.logger.log(`Seeding ${DEFAULT_TEMPLATES.length} default notification templates`);

    await this.templateRepo.save(
      DEFAULT_TEMPLATES.map((t) => this.templateRepo.create({ ...t, isActive: true })),
    );

    this.logger.log('Default notification templates seeded successfully');
  }

  /** Re-seed: add any missing templates without overwriting customised ones. */
  async seedMissing(): Promise<number> {
    let added = 0;

    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await this.templateRepo.findOne({
        where: { type: tpl.type, channel: tpl.channel },
      });
      if (!exists) {
        await this.templateRepo.save(this.templateRepo.create({ ...tpl, isActive: true }));
        added++;
      }
    }

    this.logger.log(`seedMissing: added ${added} new template(s)`);
    return added;
  }
}
