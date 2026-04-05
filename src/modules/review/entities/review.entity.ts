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
 * Review entity — represents a customer's rating and written feedback for a salon visit.
 *
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

  /** UUID of the salon being reviewed. */
  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  /** Many-to-one relation to the reviewed Salon. */
  @ManyToOne('Salon', (salon: Salon) => salon.reviews)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  /** UUID of the customer who submitted the review. */
  @Index()
  @Column({ type: 'varchar' })
  customerId: string;

  /** Many-to-one relation to the reviewing User (customer). */
  @ManyToOne('User', (user: User) => user.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  /**
   * Optional barber-level rating within the same review.
   * Null when the review targets the salon as a whole.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  barberId: string | null;

  /** Many-to-one relation to the optionally rated Barber. */
  @ManyToOne('Barber', (barber: Barber) => barber.reviews, { nullable: true })
  @JoinColumn({ name: 'barber_id' })
  barber: Barber | null;

  // ─── Proof of visit (at least one should be set for verified = true) ─────

  /**
   * UUID of the queue entry that proves the customer visited.
   * Null for unverified reviews.
   */
  @Column({ type: 'varchar', nullable: true })
  queueEntryId: string | null;

  /** Many-to-one relation to the linked QueueEntry (proof of visit). */
  @ManyToOne('QueueEntry', (qe: QueueEntry) => qe.reviews, { nullable: true })
  @JoinColumn({ name: 'queue_entry_id' })
  queueEntry: QueueEntry | null;

  /**
   * UUID of the appointment that proves the customer visited.
   * Null for unverified reviews.
   */
  @Column({ type: 'varchar', nullable: true })
  appointmentId: string | null;

  /** Many-to-one relation to the linked Appointment (proof of visit). */
  @ManyToOne('Appointment', (a: Appointment) => a.reviews, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  // ─── Review content ──────────────────────────────────────────────────────

  /**
   * Integer rating from 1 (worst) to 5 (best).
   * Enforced by DB CHECK constraint and class-validator in DTO.
   */
  @Column({ type: 'tinyint' })
  rating: number;

  /** Optional short title for the review (max 150 chars). */
  @Column({ type: 'varchar', nullable: true, length: 150 })
  title: string | null;

  /** Optional full written review body. */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  /**
   * Set to true when this review has a valid queueEntry or appointment reference.
   * Computed and stored to avoid a JOIN on every listing query.
   */
  @Column({ type: 'boolean', default: false })
  isVerifiedVisit: boolean;

  /**
   * Controls public visibility of the review.
   * Admins may set this to false to hide inappropriate content.
   */
  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  /** Timestamp when the review was first published (or re-published). */
  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  // ─── Owner reply ─────────────────────────────────────────────────────────

  /** Public reply text written by the salon owner or admin. */
  @Column({ type: 'text', nullable: true })
  replyBody: string | null;

  /** UUID of the user who wrote the reply. */
  @Column({ type: 'varchar', nullable: true })
  repliedBy: string | null;

  /** Many-to-one relation to the User who authored the reply. */
  @ManyToOne('User', (user: User) => user.reviewReplies, { nullable: true })
  @JoinColumn({ name: 'replied_by' })
  repliedByUser: User | null;

  /** Timestamp when the owner reply was last updated. */
  @Column({ type: 'datetime', nullable: true })
  repliedAt: Date | null;
}
