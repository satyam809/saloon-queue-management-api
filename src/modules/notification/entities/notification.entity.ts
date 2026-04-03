import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { NotificationType, NotificationChannel, NotificationPriority } from '@common/enums/notification.enum';
import type { User } from '@modules/user/entities/user.entity';

/**
 * One row per notification-channel delivery.
 * A single event (e.g. queue called) may generate multiple rows —
 * one for in_app, one for SMS, one for push — allowing independent delivery tracking.
 *
 * No deletedAt — notifications are never soft-deleted.
 */
@Entity('notifications')
@Index(['userId', 'isRead'])              // unread badge count (hot path)
@Index(['channel', 'sentAt'])            // delivery jobs (find pending by channel)
export class Notification extends BaseEntity {

  @Index()
  @Column()
  userId: string;

  @ManyToOne('User', (user: User) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.GENERAL })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date | null;

  /**
   * NULL = pending delivery. Set by the notification worker on successful send.
   */
  @Column({ nullable: true })
  sentAt: Date | null;

  /**
   * Contextual payload for deep-linking in the client app.
   * Example: { "queueEntryId": "uuid", "salonName": "The Style Studio", "position": 3 }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  /**
   * Type of the entity this notification relates to.
   * Used for deep-linking and grouping. E.g. 'queue_entry', 'appointment', 'payment'.
   */
  @Column({ length: 80, nullable: true })
  relatedEntityType: string | null;

  /**
   * UUID of the related entity. Not a FK — entity may be soft-deleted.
   */
  @Column({ type: 'char', length: 36, nullable: true })
  relatedEntityId: string | null;
}
