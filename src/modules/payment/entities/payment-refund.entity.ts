import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Payment } from './payment.entity';
import type { User } from '@modules/user/entities/user.entity';

/**
 * One row = one refund event on a payment.
 *
 * A payment may be refunded in multiple partial instalments.
 * The constraint refundedAmount <= totalAmount is enforced via a conditional
 * UPDATE in PaymentService.refund() using optimistic locking.
 *
 * No soft-delete: refund records are permanent ledger entries.
 * The only mutation allowed after creation is adding a gateway transactionId
 * when the gateway confirms the refund asynchronously.
 */
@Entity('payment_refunds')
@Index(['refundedAt'])
export class PaymentRefund {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  paymentId: string;

  @ManyToOne('Payment', (p: Payment) => p.refunds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  /** The staff member or system that issued this refund. */
  @Index()
  @Column({ type: 'varchar' })
  refundedById: string;

  @ManyToOne('User', (u: User) => u.ownedSalons, { nullable: true })
  @JoinColumn({ name: 'refunded_by_id' })
  refundedBy: User;

  /** Amount returned in this refund event (> 0, <= payment.totalAmount - prior refunds). */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  /**
   * External refund ID from the payment gateway.
   * Null for offline (cash) refunds or until the gateway confirms.
   */
  @Column({ type: 'varchar', nullable: true, length: 255 })
  transactionId: string | null;

  /**
   * Raw gateway refund response — stored for reconciliation.
   */
  @Column({ type: 'json', nullable: true })
  gatewayResponse: Record<string, unknown> | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  refundedAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
