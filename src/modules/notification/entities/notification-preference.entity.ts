import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';
import type { User } from '@modules/user/entities/user.entity';

/**
 * Per-user opt-in/opt-out for each (type × channel) combination.
 *
 * Convention: if no row exists for a (userId, type, channel) triple,
 * the default is ENABLED — meaning users receive all notifications unless
 * they explicitly disable them.
 */
@Entity('notification_preferences')
@Index(['userId', 'type', 'channel'], { unique: true })
@Index(['userId'])
export class NotificationPreference extends BaseEntity {

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  /** false = user has opted out of this type+channel combination. */
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;
}
