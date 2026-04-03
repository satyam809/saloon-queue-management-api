import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';
import type { PaymentRefund } from './payment-refund.entity';

/**
 * One row = one payment transaction.
 *
 * Amount invariant (enforced in service layer):
 *   totalAmount = subtotalAmount - discountAmount + taxAmount
 *
 * Refund invariant (enforced via conditional UPDATE in service):
 *   refundedAmount <= totalAmount at all times
 *
 * Source reference rule:
 *   At least one of queueEntryId / appointmentId must be non-null.
 *   Enforced in service layer, not DB (allows future walk-in sources).
 *
 * Offline payments  (method=CASH|CARD, provider=MANUAL):
 *   - Created PENDING, confirmed by staff → COMPLETED
 *   - transactionId is null, gatewayResponse is null
 *
 * Online payments   (method=ONLINE|CARD, provider=STRIPE|PAYPAL|SQUARE):
 *   - Created PENDING with gateway intent ID in transactionId
 *   - Confirmed by webhook / manual confirmation → COMPLETED
 *   - Failed by webhook / timeout → FAILED
 */
@Entity('payments')
@Index(['salonId', 'status'])
@Index(['salonId', 'paidAt'])
@Index(['customerId', 'status'])
export class Payment extends BaseEntity {

  /**
   * Human-readable reference shown on receipts — PAY-20260330-00042.
   * Generated in BeforeInsert so it is always set before the first save.
   */
  @Index({ unique: true })
  @Column({ length: 30 })
  paymentNumber: string;

  @BeforeInsert()
  generatePaymentNumber() {
    const date   = new Date();
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand   = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    this.paymentNumber = `PAY-${yyyymmdd}-${rand}`;
  }

  // ─── Parties ──────────────────────────────────────────────────────────────

  @Index()
  @Column()
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.payments)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Index()
  @Column()
  customerId: string;

  @ManyToOne('User', (user: User) => user.ownedSalons)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  // ─── Source reference ─────────────────────────────────────────────────────

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

  // ─── Amount breakdown ─────────────────────────────────────────────────────

  /** Service cost before discounts. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotalAmount: number;

  /** Coupon / promotion deduction. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  /** VAT / sales tax. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  /** subtotalAmount - discountAmount + taxAmount */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  /** Running total of all refunds issued (sum of payment_refunds.amount). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  // ─── Payment method & gateway ─────────────────────────────────────────────

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  /** Which external service processed the payment. MANUAL = offline. */
  @Column({ type: 'enum', enum: PaymentProvider, default: PaymentProvider.MANUAL })
  provider: PaymentProvider;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /**
   * Gateway payment / charge / intent ID.
   * Null for offline (MANUAL) payments.
   * Used for idempotency checks on webhook delivery.
   */
  @Index()
  @Column({ nullable: true, length: 255 })
  transactionId: string | null;

  /**
   * Raw gateway response — stored verbatim for dispute resolution and
   * reconciliation. Never returned to clients.
   */
  @Column({ type: 'json', nullable: true })
  gatewayResponse: Record<string, unknown> | null;

  // ─── Failure & cancellation ───────────────────────────────────────────────

  /** Set when status → FAILED. Surfaced in the management UI. */
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  // ─── Internal notes ───────────────────────────────────────────────────────

  /** Staff / system notes — not visible to customers. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Lifecycle timestamps ─────────────────────────────────────────────────

  @Column({ nullable: true })
  paidAt: Date | null;

  @Column({ nullable: true })
  cancelledAt: Date | null;

  // ─── Relationships ────────────────────────────────────────────────────────

  @OneToMany('PaymentRefund', (r: PaymentRefund) => r.payment, { cascade: true })
  refunds: PaymentRefund[];
}
