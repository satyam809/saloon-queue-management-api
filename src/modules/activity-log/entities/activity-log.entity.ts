import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import type { User } from '@modules/user/entities/user.entity';
import type { Role } from '@common/enums/role.enum';

/**
 * Immutable audit trail for every state-changing operation.
 *
 * Design decisions:
 *   - No updatedAt / deletedAt — logs are append-only and permanent.
 *   - user_id ON DELETE SET NULL — logs survive user deletion.
 *   - entity_type + entity_id = polymorphic reference (no FK, intentional).
 *   - action uses dot-notation for easy filtering: 'salon.verified', 'queue.entry.cancelled'.
 *
 * Typical usage in services:
 *   await this.activityLogRepo.save({
 *     userId:     currentUser.sub,
 *     action:     'appointment.cancelled',
 *     entityType: 'appointment',
 *     entityId:   appointment.id,
 *     oldValues:  { status: 'confirmed' },
 *     newValues:  { status: 'cancelled', reason: dto.reason },
 *     ipAddress:  req.ip,
 *     userAgent:  req.headers['user-agent'],
 *   });
 */
@Entity('activity_logs')
@Index(['entityType', 'entityId'])       // full audit trail for one record
@Index(['userId'])
@Index(['action'])
@Index(['category'])
@Index(['createdAt'])                    // time-range queries / retention purge
export class ActivityLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * NULL when triggered by a system job or scheduled task (no authenticated user).
   */
  @Column({ nullable: true })
  userId: string | null;

  /**
   * Role of the actor at the time of the action.
   * NULL for system/scheduled jobs.
   */
  @Column({ nullable: true, length: 20 })
  actorRole: Role | null;

  @ManyToOne('User', (user: User) => user.activityLogs, {
    nullable: true,
    onDelete: 'SET NULL',               // preserve logs even when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  /**
   * Dot-notation action descriptor.
   * Convention: <entity>.<sub-entity?>.<verb>
   * Examples: 'salon.verified', 'queue.entry.cancelled', 'user.suspended'
   */
  @Column({ length: 100 })
  action: string;

  /**
   * Top-level category grouping for efficient filtering.
   * Values: 'queue', 'payment', 'barber', 'service', 'review', 'user', 'salon', 'appointment'
   */
  @Column({ length: 50 })
  category: string;

  /**
   * Name of the affected entity type (matches table name without pluralisation).
   * Examples: 'salon', 'queue_entry', 'appointment'
   */
  @Column({ length: 80 })
  entityType: string;

  /**
   * UUID of the affected record.
   * Not a FK — referenced entity may be soft-deleted or hard-deleted.
   */
  @Column({ type: 'char', length: 36 })
  entityId: string;

  /**
   * Full state of the record before the change.
   * NULL for create operations.
   */
  @Column({ type: 'json', nullable: true })
  oldValues: Record<string, any> | null;

  /**
   * Full state of the record after the change.
   * NULL for delete operations.
   */
  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any> | null;

  /**
   * Arbitrary context beyond state diffs.
   * Examples: { reason: '...', tokenNumber: 7 }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * Supports IPv6 (max 45 chars).
   */
  @Column({ nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ nullable: true, length: 500 })
  userAgent: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
