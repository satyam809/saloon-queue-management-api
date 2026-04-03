import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentProvider } from '@common/enums/status.enum';

export class CreatePaymentDto {
  // ─── Source (at least one required — validated in service) ───────────────

  @ApiPropertyOptional({ description: 'Queue entry this payment is for' })
  @IsOptional()
  @IsUUID()
  queueEntryId?: string;

  @ApiPropertyOptional({ description: 'Appointment this payment is for' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  // ─── Parties ──────────────────────────────────────────────────────────────

  @ApiProperty({ description: 'Salon UUID' })
  @IsUUID()
  salonId: string;

  @ApiProperty({ description: 'Customer UUID' })
  @IsUUID()
  customerId: string;

  // ─── Amounts ──────────────────────────────────────────────────────────────

  @ApiProperty({ example: 25.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  subtotalAmount: number;

  @ApiPropertyOptional({ example: 2.50, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 1.75, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'AED', 'INR', 'PKR', 'CAD', 'AUD'])
  currency?: string;

  // ─── Method & gateway ─────────────────────────────────────────────────────

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentProvider, default: PaymentProvider.MANUAL })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  /**
   * For online payments — supply the gateway's payment intent / charge ID
   * at creation time so webhooks can match incoming events.
   */
  @ApiPropertyOptional({ example: 'pi_3OxxxxxSTRIPE_INTENT' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
