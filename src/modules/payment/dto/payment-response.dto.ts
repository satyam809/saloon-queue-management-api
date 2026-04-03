import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@common/enums/status.enum';
import { Payment } from '../entities/payment.entity';
import { PaymentRefund } from '../entities/payment-refund.entity';

export class PaymentRefundResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() paymentId: string;
  @ApiProperty() refundedById: string;
  @ApiProperty() amount: number;
  @ApiProperty() reason: string;
  @ApiPropertyOptional() transactionId: string | null;
  @ApiProperty() refundedAt: Date;
  @ApiProperty() createdAt: Date;

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

export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() paymentNumber: string;
  @ApiProperty() salonId: string;
  @ApiProperty() customerId: string;
  @ApiPropertyOptional() queueEntryId: string | null;
  @ApiPropertyOptional() appointmentId: string | null;

  // Amounts
  @ApiProperty() subtotalAmount: number;
  @ApiProperty() discountAmount: number;
  @ApiProperty() taxAmount: number;
  @ApiProperty() totalAmount: number;
  @ApiProperty() refundedAmount: number;
  @ApiProperty() currency: string;

  // Method & status
  @ApiProperty({ enum: PaymentMethod })  paymentMethod: PaymentMethod;
  @ApiProperty({ enum: PaymentProvider }) provider: PaymentProvider;
  @ApiProperty({ enum: PaymentStatus })  status: PaymentStatus;
  @ApiPropertyOptional() transactionId: string | null;

  // Notes & failure
  @ApiPropertyOptional() notes: string | null;
  @ApiPropertyOptional() failureReason: string | null;

  // Timestamps
  @ApiPropertyOptional() paidAt: Date | null;
  @ApiPropertyOptional() cancelledAt: Date | null;
  @ApiProperty()         createdAt: Date;
  @ApiProperty()         updatedAt: Date;

  // Nested refunds (populated when relations are loaded)
  @ApiPropertyOptional({ type: [PaymentRefundResponseDto] })
  refunds?: PaymentRefundResponseDto[];

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
