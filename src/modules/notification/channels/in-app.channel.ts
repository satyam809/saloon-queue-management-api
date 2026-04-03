import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';
import { INotificationChannel } from './notification-channel.interface';

/**
 * In-app channel adapter.
 *
 * The dispatcher already persists the Notification row before calling send(),
 * so the notification is immediately visible in the user's in-app inbox.
 * This adapter is intentionally a no-op — delivery is the DB write itself.
 *
 * Future extension point: emit a WebSocket event here so connected clients
 * receive a real-time push without polling.
 */
@Injectable()
export class InAppChannelAdapter implements INotificationChannel {
  readonly channel = NotificationChannel.IN_APP;

  async send(_notification: Notification): Promise<void> {
    // No-op: in-app delivery is implicit via the persisted DB row.
    // Extend here to emit a WebSocket / SSE event.
  }
}
