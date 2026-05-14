import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { SalonStatus } from '@common/enums/status.enum';
import type { User } from '@modules/user/entities/user.entity';
import type { Staff } from '@modules/staff/entities/staff.entity';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { Service } from '@modules/service/entities/service.entity';
import type { Queue } from '@modules/queue/entities/queue.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';
import type { Payment } from '@modules/payment/entities/payment.entity';
import type { Review } from '@modules/review/entities/review.entity';

/**
 * TypeORM entity representing a salon in the `salons` table.
 *
 * A salon is the top-level aggregate that owns barbers, services, queues,
 * appointments, payments, and reviews. New salons start in PENDING status
 * and become ACTIVE only after onboarding staff verification.
 *
 * Composite indexes:
 * - `[isVerified, status]` — fast filtering of verified/active salons.
 * - `[latitude, longitude]` — geo-proximity queries.
 */
@Entity('salons')
@Index(['isVerified', 'status'])
@Index(['latitude', 'longitude'])        // geo-proximity queries
export class Salon extends BaseEntity {

  /** UUID of the user who added/registered this salon. */
  @Column({ type: 'varchar', name: 'added_by' })
  addedById: string;

  /** The user who added/registered this salon. */
  @ManyToOne('User', (user: User) => user.ownedSalons)
  @JoinColumn({ name: 'added_by' })
  addedBy: User;

  /** UUID of the onboarding staff member who approved this salon (null if not yet approved). */
  // Onboarding staff who approved this salon
  @Column({ type: 'varchar', nullable: true })
  verifiedBy: string | null;

  /** The staff or admin user who verified this salon. */
  @ManyToOne('User', (user: User) => user.verifiedSalons, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifier: User | null;

  /** Display name of the salon (max 150 characters). */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** URL-safe unique identifier derived from the salon name (max 160 characters). */
  @Column({ type: 'varchar', unique: true, length: 160 })
  slug: string;

  /** Optional long-form description of the salon and its offerings. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── Location ────────────────────────────────────────────────────────────

  /** Street address of the salon. */
  @Column({ type: 'varchar', nullable: true, length: 255 })
  address: string | null;

  /** City where the salon is located. */
  @Column({ type: 'varchar', nullable: true, length: 100 })
  city: string | null;

  /** State or province where the salon is located. */
  @Column({ type: 'varchar', nullable: true, length: 100 })
  state: string | null;

  /** ISO country code (defaults to `'US'`). */
  @Column({ type: 'varchar', nullable: true, length: 100, default: 'US' })
  country: string;

  /** Postal/ZIP code of the salon's location. */
  @Column({ type: 'varchar', nullable: true, length: 20 })
  postalCode: string | null;

  /** Geographic latitude for proximity search (precision: 10, scale: 8). */
  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  /** Geographic longitude for proximity search (precision: 11, scale: 8). */
  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  // ─── Media ───────────────────────────────────────────────────────────────

  /** URL of the salon's logo image. */
  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  /** URL of the salon's cover/banner image. */
  @Column({ type: 'text', nullable: true })
  coverImageUrl: string | null;

  // ─── Business config ─────────────────────────────────────────────────────

  /** Current lifecycle status of the salon (PENDING, ACTIVE, INACTIVE, etc.). */
  @Index()
  @Column({ type: 'enum', enum: SalonStatus, default: SalonStatus.PENDING })
  status: SalonStatus;

  /** Whether an onboarding staff member has verified this salon. */
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  /** Timestamp of when the salon was verified; null if not yet verified. */
  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  /** Populated when status=REJECTED — reason provided by the reviewer. */
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  /** Default service duration used when a service does not specify its own (in minutes). */
  @Column({ type: 'smallint', default: 30 })
  avgServiceDurationMinutes: number;

  /** Maximum number of entries allowed in the salon's active queue. */
  @Column({ type: 'smallint', default: 20 })
  maxQueueSize: number;

  /**
   * JSON shape: { "mon": { "open": "09:00", "close": "18:00" }, ... }
   * Days: mon, tue, wed, thu, fri, sat, sun
   * null = closed that day
   */
  @Column({ type: 'json', nullable: true })
  workingHours: Record<string, { open: string; close: string } | null> | null;

  /** IANA timezone identifier used to interpret working hours (e.g. `'America/New_York'`). */
  @Column({ type: 'varchar', default: 'UTC', length: 50 })
  timezone: string;

  // ─── Relationships ───────────────────────────────────────────────────────

  /** Staff members employed by this salon. */
  @OneToMany('Staff', (s: Staff) => s.salon)
  staff: Staff[];

  /** Barbers working at this salon. */
  @OneToMany('Barber', (b: Barber) => b.salon)
  barbers: Barber[];

  /** Services offered by this salon. */
  @OneToMany('Service', (s: Service) => s.salon)
  services: Service[];

  /** Queue sessions associated with this salon. */
  @OneToMany('Queue', (q: Queue) => q.salon)
  queues: Queue[];

  /** Appointments booked at this salon. */
  @OneToMany('Appointment', (a: Appointment) => a.salon)
  appointments: Appointment[];

  /** Payments processed for services at this salon. */
  @OneToMany('Payment', (p: Payment) => p.salon)
  payments: Payment[];

  /** Customer reviews submitted for this salon. */
  @OneToMany('Review', (r: Review) => r.salon)
  reviews: Review[];
}
