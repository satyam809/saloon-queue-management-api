import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';
import { INotificationChannel } from './notification-channel.interface';

/**
 * Push notification channel adapter — stub implementation.
 *
 * Integration point: replace the logger call with a real push provider.
 * Recommended: Firebase Cloud Messaging (FCM) via `firebase-admin`,
 * or Expo Push Notifications for React Native apps.
 *
 * Device tokens are typically stored on the user record or a separate
 * device_tokens table per user.
 */
@Injectable()
export class PushChannelAdapter implements INotificationChannel {
  readonly channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(PushChannelAdapter.name);

  async send(notification: Notification): Promise<void> {
    this.logger.log(
      `[PUSH stub] userId=${notification.userId} | title="${notification.title}" | body="${notification.body}"`,
    );
    // TODO: integrate push provider
    // Example (FCM):
    // const tokens = await this.deviceTokenRepo.findTokensByUser(notification.userId);
    // await admin.messaging().sendEachForMulticast({
    //   tokens,
    //   notification: { title: notification.title, body: notification.body },
    //   data: notification.metadata ?? {},
    // });
  }
}
