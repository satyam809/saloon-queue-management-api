import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  /**
   * Amount to refund. Must be > 0 and <= (totalAmount - already refundedAmount).
   * Validated against live DB values in the service with a conditional UPDATE
   * to prevent race conditions.
   */
  @ApiProperty({
    example: 12.50,
    description: 'Amount to refund. Partial refunds are supported.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @ApiProperty({ example: 'Customer dissatisfied with the service' })
  @IsString()
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional({
    example: 're_3OxxxxxSTRIPE_REFUND',
    description: 'Gateway refund ID — supplied when the refund is processed externally',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Raw gateway refund response payload' })
  @IsOptional()
  @IsObject()
  gatewayResponse?: Record<string, unknown>;
}
