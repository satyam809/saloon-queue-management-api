import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { PaymentMethod, PaymentStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';

/**
 * A payment record is always linked to either a QueueEntry or an Appointment.
 * At least one of queueEntryId / appointmentId must be non-null (enforced in service layer).
 *
 * Amount breakdown:
 *   totalAmount = subtotalAmount - discountAmount + taxAmount
 */
@Entity('payments')
@Index(['salonId', 'status'])
@Index(['paidAt'])
export class Payment extends BaseEntity {

  @Index()
  @Column()
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.payments)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Index()
  @Column()
  customerId: string;

  @ManyToOne('User', (user: User) => user.reviews)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  // ─── Source reference (one of the two must be set) ───────────────────────

  @Index()
  @Column({ nullable: true })
  queueEntryId: string | null;

  @ManyToOne('QueueEntry', (qe: QueueEntry) => qe.payments, { nullable: true })
  @JoinColumn({ name: 'queue_entry_id' })
  queueEntry: QueueEntry | null;

  @Index()
  @Column({ nullable: true })
  appointmentId: string | null;

  @ManyToOne('Appointment', (a: Appointment) => a.payments, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  // ─── Amounts ─────────────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  // ─── Gateway ─────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /**
   * External reference from the payment gateway (Stripe charge ID, etc.).
   */
  @Index()
  @Column({ nullable: true, length: 255 })
  transactionId: string | null;

  /**
   * Raw response payload from the payment gateway.
   * Stored for debugging and dispute resolution.
   */
  @Column({ type: 'json', nullable: true })
  gatewayResponse: Record<string, any> | null;

  // ─── Refunds ─────────────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ nullable: true, length: 255 })
  refundReason: string | null;

  // ─── Lifecycle timestamps ────────────────────────────────────────────────

  @Column({ nullable: true })
  paidAt: Date | null;

  @Column({ nullable: true })
  refundedAt: Date | null;
}
