import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { QueueStatus } from '@common/enums/status.enum';
import type { Queue } from './queue.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { Service } from '@modules/service/entities/service.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';
import type { Payment } from '@modules/payment/entities/payment.entity';
import type { Review } from '@modules/review/entities/review.entity';

@Entity('queue_entries')
@Unique(['queueId', 'tokenNumber'])                              // unique ticket per queue
@Index(['queueId', 'status', 'position'])                       // call-next query (hot path)
@Index(['customerId', 'status'])                                 // my active queue
export class QueueEntry extends BaseEntity {

  @Index()
  @Column()
  queueId: string;

  @ManyToOne('Queue', (queue: Queue) => queue.entries)
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @Index()
  @Column()
  customerId: string;

  @ManyToOne('User', (user: User) => user.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  /**
   * Preferred barber — optional. NULL = any available barber.
   */
  @Index()
  @Column({ nullable: true })
  barberId: string | null;

  @ManyToOne('Barber', (barber: Barber) => barber.queueEntries, { nullable: true })
  @JoinColumn({ name: 'barber_id' })
  barber: Barber | null;

  /**
   * Service requested — optional at check-in.
   */
  @Index()
  @Column({ nullable: true })
  serviceId: string | null;

  @ManyToOne('Service', (service: Service) => service.queueEntries, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  /**
   * Display number shown on the screen / SMS (e.g. token 7 → "A-007").
   */
  @Column({ type: 'smallint' })
  tokenNumber: number;

  /**
   * Internal sort order within the queue.
   */
  @Column({ type: 'smallint' })
  position: number;

  @Index()
  @Column({ type: 'enum', enum: QueueStatus, default: QueueStatus.WAITING })
  status: QueueStatus;

  /**
   * Estimated wait in minutes at the time of check-in.
   * Formula: position × salon.avgServiceDurationMinutes
   */
  @Column({ type: 'smallint', nullable: true })
  estimatedWaitMinutes: number | null;

  // ─── Lifecycle timestamps ────────────────────────────────────────────────

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  checkedInAt: Date;

  @Column({ nullable: true })
  calledAt: Date | null;

  @Column({ nullable: true })
  serviceStartedAt: Date | null;

  @Column({ nullable: true })
  completedAt: Date | null;

  @Column({ nullable: true })
  cancelledAt: Date | null;

  @Column({ nullable: true, length: 255 })
  cancellationReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Relationships ───────────────────────────────────────────────────────

  // Appointment that was converted into this queue entry on check-in
  @OneToOne('Appointment', (a: Appointment) => a.queueEntry)
  appointment: Appointment | null;

  @OneToMany('Payment', (p: Payment) => p.queueEntry)
  payments: Payment[];

  @OneToMany('Review', (r: Review) => r.queueEntry)
  reviews: Review[];
}
