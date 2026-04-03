import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';
import { INotificationChannel } from './notification-channel.interface';

/**
 * Email channel adapter — stub implementation.
 *
 * Integration point: replace the logger call with a real email provider.
 * Recommended: @nestjs/mailer + nodemailer (SMTP) or SendGrid / AWS SES SDK.
 *
 * The userId on the notification can be used to load the user's email address
 * from UserService before sending.
 */
@Injectable()
export class EmailChannelAdapter implements INotificationChannel {
  readonly channel = NotificationChannel.EMAIL;
  private readonly logger = new Logger(EmailChannelAdapter.name);

  async send(notification: Notification): Promise<void> {
    this.logger.log(
      `[EMAIL stub] userId=${notification.userId} | subject="${notification.title}" | body="${notification.body}"`,
    );
    // TODO: integrate email provider
    // Example:
    // const user = await this.userService.findById(notification.userId);
    // await this.mailerService.sendMail({
    //   to: user.email,
    //   subject: notification.title,
    //   html: notification.body,
    // });
  }
}
