import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@common/enums/status.enum';
import { Payment } from '../entities/payment.entity';
import { PaymentRefund } from '../entities/payment-refund.entity';

/**
 * Response Data Transfer Object representing a single payment refund record.
 *
 * Exposes all relevant fields of a {@link PaymentRefund} entity in a
 * serialisation-safe shape, converting numeric decimal columns to JavaScript
 * `number` values.
 */
export class PaymentRefundResponseDto {
  /** Unique identifier of the refund record (UUID). */
  @ApiProperty() id: string;

  /** UUID of the parent payment that was refunded. */
  @ApiProperty() paymentId: string;

  /** UUID of the staff member or admin who authorised and processed the refund. */
  @ApiProperty() refundedById: string;

  /** Monetary amount that was refunded, expressed as a positive number. */
  @ApiProperty() amount: number;

  /** Human-readable explanation for why the refund was issued. */
  @ApiProperty() reason: string;

  /**
   * Gateway-issued transaction identifier for the refund operation,
   * or `null` when the gateway did not return one.
   */
  @ApiPropertyOptional() transactionId: string | null;

  /** Timestamp at which the refund was processed. */
  @ApiProperty() refundedAt: Date;

  /** Timestamp at which the refund record was created in the database. */
  @ApiProperty() createdAt: Date;

  /**
   * Maps a {@link PaymentRefund} entity to a {@link PaymentRefundResponseDto}.
   *
   * Explicitly casts `amount` to a JavaScript `number` to avoid returning a
   * raw decimal string from the ORM.
   *
   * @param r - The source {@link PaymentRefund} entity to map.
   * @returns A fully populated {@link PaymentRefundResponseDto}.
   */
  static from(r: PaymentRefund): PaymentRefundResponseDto {
    const dto          = new PaymentRefundResponseDto();
    dto.id             = r.id;
    dto.paymentId      = r.paymentId;
    dto.refundedById   = r.refundedById;
    dto.amount         = Number(r.amount);
    dto.reason         = r.reason;
    dto.transactionId  = r.transactionId;
    dto.refundedAt     = r.refundedAt;
    dto.createdAt      = r.createdAt;
    return dto;
  }
}

/**
 * Response Data Transfer Object representing a complete payment record.
 *
 * Exposes all monetary, status, and relational fields of a {@link Payment}
 * entity. Optionally embeds a list of associated {@link PaymentRefundResponseDto}
 * objects when `includeRefunds` is set to `true` in the static factory method.
 */
export class PaymentResponseDto {
  /** Unique identifier of the payment record (UUID). */
  @ApiProperty() id: string;

  /**
   * Human-readable sequential payment reference number.
   *
   * @example 'PAY-000123'
   */
  @ApiProperty() paymentNumber: string;

  /** UUID of the salon that received the payment. */
  @ApiProperty() salonId: string;

  /** UUID of the customer who made the payment. */
  @ApiProperty() customerId: string;

  /**
   * UUID of the queue entry this payment is associated with, or `null` when
   * the payment is linked to an appointment instead.
   */
  @ApiPropertyOptional() queueEntryId: string | null;

  /**
   * UUID of the appointment this payment is associated with, or `null` when
   * the payment is linked to a queue entry instead.
   */
  @ApiPropertyOptional() appointmentId: string | null;

  // Amounts

  /** Pre-discount subtotal amount for the transaction. */
  @ApiProperty() subtotalAmount: number;

  /** Total discount amount applied to the transaction. */
  @ApiProperty() discountAmount: number;

  /** Tax amount applied to the transaction. */
  @ApiProperty() taxAmount: number;

  /** Final amount charged to the customer after discounts and tax. */
  @ApiProperty() totalAmount: number;

  /**
   * Cumulative amount that has been refunded against this payment.
   * Zero when no refunds have been issued.
   */
  @ApiProperty() refundedAmount: number;

  /**
   * ISO 4217 currency code for all monetary amounts.
   *
   * @example 'USD'
   */
  @ApiProperty() currency: string;

  // Method & status

  /** Payment method used by the customer. */
  @ApiProperty({ enum: PaymentMethod })  paymentMethod: PaymentMethod;

  /** Payment gateway or provider that processed the transaction. */
  @ApiProperty({ enum: PaymentProvider }) provider: PaymentProvider;

  /** Current lifecycle status of the payment. */
  @ApiProperty({ enum: PaymentStatus })  status: PaymentStatus;

  /**
   * Gateway-issued transaction reference identifier, or `null` when unavailable.
   */
  @ApiPropertyOptional() transactionId: string | null;

  // Notes & failure

  /** Optional internal or customer-facing notes attached to the payment. */
  @ApiPropertyOptional() notes: string | null;

  /**
   * Human-readable reason the payment failed, or `null` for non-failed payments.
   */
  @ApiPropertyOptional() failureReason: string | null;

  // Timestamps

  /** Timestamp at which the payment was successfully captured, or `null`. */
  @ApiPropertyOptional() paidAt: Date | null;

  /** Timestamp at which the payment was cancelled, or `null`. */
  @ApiPropertyOptional() cancelledAt: Date | null;

  /** Timestamp at which the payment record was first created. */
  @ApiProperty()         createdAt: Date;

  /** Timestamp at which the payment record was last modified. */
  @ApiProperty()         updatedAt: Date;

  // Nested refunds (populated when relations are loaded)

  /**
   * List of refunds issued against this payment.
   * Only populated when the `includeRefunds` flag is `true` in {@link PaymentResponseDto.from}
   * and the `refunds` relation has been loaded on the entity.
   */
  @ApiPropertyOptional({ type: [PaymentRefundResponseDto] })
  refunds?: PaymentRefundResponseDto[];

  /**
   * Maps a {@link Payment} entity to a {@link PaymentResponseDto}.
   *
   * Explicitly casts all decimal/numeric columns to JavaScript `number` values.
   * Conditionally maps nested refunds when `includeRefunds` is `true` and
   * the `refunds` relation is present on the entity.
   *
   * @param p              - The source {@link Payment} entity to map.
   * @param includeRefunds - When `true`, nested refund records are mapped and included.
   *                         Defaults to `false`.
   * @returns A fully populated {@link PaymentResponseDto}.
   */
  static from(p: Payment, includeRefunds = false): PaymentResponseDto {
    const dto              = new PaymentResponseDto();
    dto.id                 = p.id;
    dto.paymentNumber      = p.paymentNumber;
    dto.salonId            = p.salonId;
    dto.customerId         = p.customerId;
    dto.queueEntryId       = p.queueEntryId;
    dto.appointmentId      = p.appointmentId;
    dto.subtotalAmount     = Number(p.subtotalAmount);
    dto.discountAmount     = Number(p.discountAmount);
    dto.taxAmount          = Number(p.taxAmount);
    dto.totalAmount        = Number(p.totalAmount);
    dto.refundedAmount     = Number(p.refundedAmount);
    dto.currency           = p.currency;
    dto.paymentMethod      = p.paymentMethod;
    dto.provider           = p.provider;
    dto.status             = p.status;
    dto.transactionId      = p.transactionId;
    dto.notes              = p.notes;
    dto.failureReason      = p.failureReason;
    dto.paidAt             = p.paidAt;
    dto.cancelledAt        = p.cancelledAt;
    dto.createdAt          = p.createdAt;
    dto.updatedAt          = p.updatedAt;

    if (includeRefunds && p.refunds) {
      dto.refunds = p.refunds.map(PaymentRefundResponseDto.from);
    }

    return dto;
  }
}
