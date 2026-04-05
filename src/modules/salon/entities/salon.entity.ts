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

@Entity('salons')
@Index(['isVerified', 'status'])
@Index(['latitude', 'longitude'])        // geo-proximity queries
export class Salon extends BaseEntity {

  @Column({ type: 'varchar' })
  ownerId: string;

  @ManyToOne('User', (user: User) => user.ownedSalons)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // Onboarding staff who approved this salon
  @Column({ type: 'varchar', nullable: true })
  verifiedBy: string | null;

  @ManyToOne('User', (user: User) => user.verifiedSalons, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifier: User | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', unique: true, length: 160 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── Location ────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', nullable: true, length: 255 })
  address: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  city: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  state: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100, default: 'US' })
  country: string;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  postalCode: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  // ─── Contact ─────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', nullable: true, length: 20 })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  email: string | null;

  // ─── Media ───────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl: string | null;

  // ─── Business config ─────────────────────────────────────────────────────

  @Index()
  @Column({ type: 'enum', enum: SalonStatus, default: SalonStatus.PENDING })
  status: SalonStatus;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  /** Populated when status=REJECTED — reason provided by the reviewer. */
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'smallint', default: 30 })
  avgServiceDurationMinutes: number;

  @Column({ type: 'smallint', default: 20 })
  maxQueueSize: number;

  /**
   * JSON shape: { "mon": { "open": "09:00", "close": "18:00" }, ... }
   * Days: mon, tue, wed, thu, fri, sat, sun
   * null = closed that day
   */
  @Column({ type: 'json', nullable: true })
  workingHours: Record<string, { open: string; close: string } | null> | null;

  @Column({ type: 'varchar', default: 'UTC', length: 50 })
  timezone: string;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('Staff', (s: Staff) => s.salon)
  staff: Staff[];

  @OneToMany('Barber', (b: Barber) => b.salon)
  barbers: Barber[];

  @OneToMany('Service', (s: Service) => s.salon)
  services: Service[];

  @OneToMany('Queue', (q: Queue) => q.salon)
  queues: Queue[];

  @OneToMany('Appointment', (a: Appointment) => a.salon)
  appointments: Appointment[];

  @OneToMany('Payment', (p: Payment) => p.salon)
  payments: Payment[];

  @OneToMany('Review', (r: Review) => r.salon)
  reviews: Review[];
}
