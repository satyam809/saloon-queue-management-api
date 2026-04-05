import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';

/**
 * A customer can leave one review per verified visit.
 * A visit is verified when queue_entry_id or appointment_id is set
 * (i.e. the customer actually showed up and was served).
 *
 * Owner/staff can reply once per review via reply_body / replied_by.
 *
 * Duplicate prevention:
 *   UNIQUE(customer_id, queue_entry_id)  — one review per queue visit
 *   UNIQUE(customer_id, appointment_id) — one review per appointment
 */
@Entity('reviews')
@Unique(['customerId', 'queueEntryId'])
@Unique(['customerId', 'appointmentId'])
@Check(`"rating" BETWEEN 1 AND 5`)
@Index(['salonId', 'rating'])             // avg rating aggregation
@Index(['isPublished', 'salonId'])        // published reviews listing
export class Review extends BaseEntity {

  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.reviews)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Index()
  @Column({ type: 'varchar' })
  customerId: string;

  @ManyToOne('User', (user: User) => user.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  /**
   * Optional barber-level rating within the same review.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  barberId: string | null;

  @ManyToOne('Barber', (barber: Barber) => barber.reviews, { nullable: true })
  @JoinColumn({ name: 'barber_id' })
  barber: Barber | null;

  // ─── Proof of visit (at least one should be set for verified = true) ─────

  @Column({ type: 'varchar', nullable: true })
  queueEntryId: string | null;

  @ManyToOne('QueueEntry', (qe: QueueEntry) => qe.reviews, { nullable: true })
  @JoinColumn({ name: 'queue_entry_id' })
  queueEntry: QueueEntry | null;

  @Column({ type: 'varchar', nullable: true })
  appointmentId: string | null;

  @ManyToOne('Appointment', (a: Appointment) => a.reviews, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  // ─── Review content ──────────────────────────────────────────────────────

  /**
   * Integer 1–5. Enforced by DB CHECK constraint and class-validator in DTO.
   */
  @Column({ type: 'tinyint' })
  rating: number;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /**
   * Set to true when this review has a valid queueEntry or appointment reference.
   * Computed and stored to avoid a JOIN on every listing query.
   */
  @Column({ type: 'boolean', default: false })
  isVerifiedVisit: boolean;

  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  // ─── Owner reply ─────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  replyBody: string | null;

  @Column({ type: 'varchar', nullable: true })
  repliedBy: string | null;

  @ManyToOne('User', (user: User) => user.reviewReplies, { nullable: true })
  @JoinColumn({ name: 'replied_by' })
  repliedByUser: User | null;

  @Column({ type: 'datetime', nullable: true })
  repliedAt: Date | null;
}
