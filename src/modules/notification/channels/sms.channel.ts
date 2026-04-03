import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';
import { INotificationChannel } from './notification-channel.interface';

/**
 * SMS channel adapter — stub implementation.
 *
 * Integration point: replace the logger call with a real SMS provider.
 * Recommended: Twilio SDK (`twilio`) or AWS SNS.
 *
 * The userId on the notification can be used to load the user's phone number
 * from UserService before sending.
 */
@Injectable()
export class SmsChannelAdapter implements INotificationChannel {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger(SmsChannelAdapter.name);

  async send(notification: Notification): Promise<void> {
    this.logger.log(
      `[SMS stub] userId=${notification.userId} | message="${notification.body}"`,
    );
    // TODO: integrate SMS provider
    // Example (Twilio):
    // const user = await this.userService.findById(notification.userId);
    // await this.twilioClient.messages.create({
    //   to: user.phone,
    //   from: process.env.TWILIO_FROM,
    //   body: notification.body,
    // });
  }
}
