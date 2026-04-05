import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { AppointmentStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { Service } from '@modules/service/entities/service.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Payment } from '@modules/payment/entities/payment.entity';
import type { Review } from '@modules/review/entities/review.entity';

@Entity('appointments')
// Barber double-booking conflict detection (hot path on every booking)
@Index(['barberId', 'scheduledAt', 'endsAt', 'status'])
// Reminder job: find upcoming unreminded confirmed appointments
@Index(['status', 'scheduledAt', 'reminderSentAt'])
export class Appointment extends BaseEntity {

  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.appointments)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Index()
  @Column({ type: 'varchar' })
  customerId: string;

  @ManyToOne('User', (user: User) => user.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  barberId: string | null;

  @ManyToOne('Barber', (barber: Barber) => barber.appointments, { nullable: true })
  @JoinColumn({ name: 'barber_id' })
  barber: Barber | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  serviceId: string | null;

  @ManyToOne('Service', (service: Service) => service.appointments, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  /**
   * When the customer checks in on the day of the appointment,
   * a QueueEntry is created and this FK is set.
   */
  @Column({ type: 'varchar', nullable: true })
  queueEntryId: string | null;

  @OneToOne('QueueEntry', (qe: QueueEntry) => qe.appointment, { nullable: true })
  @JoinColumn({ name: 'queue_entry_id' })
  queueEntry: QueueEntry | null;

  @Index()
  @Column({ type: 'datetime' })
  scheduledAt: Date;

  /**
   * Stored (not computed) so the conflict-detection index can reference it.
   * Must be kept in sync: endsAt = scheduledAt + durationMinutes.
   */
  @Column({ type: 'datetime' })
  endsAt: Date;

  @Column({ type: 'smallint', default: 30 })
  durationMinutes: number;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  serviceType: string | null;

  @Index()
  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  // ─── Lifecycle timestamps ────────────────────────────────────────────────

  @Column({ type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  reminderSentAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  cancellationReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('Payment', (p: Payment) => p.appointment)
  payments: Payment[];

  @OneToMany('Review', (r: Review) => r.appointment)
  reviews: Review[];
}
