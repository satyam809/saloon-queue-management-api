import { NotificationChannel } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';

/**
 * Contract that every channel adapter must implement.
 * The dispatcher calls send() after persisting the Notification row;
 * adapters are responsible for the actual delivery side-effect.
 */
export interface INotificationChannel {
  readonly channel: NotificationChannel;
  /**
   * Deliver the notification via this channel.
   * Implementations MUST NOT throw — catch internally and log.
   * The dispatcher marks sentAt only when this resolves without error.
   */
  send(notification: Notification): Promise<void>;
}
