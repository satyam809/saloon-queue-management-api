import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

/**
 * One template row per (type × channel) combination.
 * The dispatcher looks up the active template to render title + body before persisting
 * and sending a Notification row.
 *
 * Template variables use {{mustache}} syntax.
 * Common variables: {{userName}}, {{salonName}}, {{tokenNumber}}, {{date}}, {{time}}, {{amount}}, {{currency}}
 */
@Entity('notification_templates')
@Index(['type', 'channel'], { unique: true })
export class NotificationTemplate extends BaseEntity {

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  /**
   * Short title shown as notification header.
   * Supports {{variable}} interpolation.
   */
  @Column({ length: 250 })
  titleTemplate: string;

  /**
   * Full notification body.
   * Supports {{variable}} interpolation.
   */
  @Column({ type: 'text' })
  bodyTemplate: string;

  /** Inactive templates are skipped by the dispatcher. */
  @Column({ default: true })
  isActive: boolean;
}
