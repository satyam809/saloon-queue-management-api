import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Used when the gateway callback / webhook arrives confirming the payment.
 * The service sets status → COMPLETED and stores the raw gateway payload.
 */
export class ConfirmOnlinePaymentDto {
  @ApiProperty({
    example: 'ch_3OxxxxxSTRIPE_CHARGE',
    description: 'Gateway transaction / charge ID returned on successful capture',
  })
  @IsString()
  @MaxLength(255)
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Full gateway response payload — stored verbatim for reconciliation',
  })
  @IsOptional()
  @IsObject()
  gatewayResponse?: Record<string, unknown>;
}
