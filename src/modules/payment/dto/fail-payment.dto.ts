import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for recording a failed payment.
 *
 * Carries the optional human-readable failure reason and the raw response
 * payload returned by the payment gateway so both can be persisted for
 * debugging and audit purposes.
 */
export class FailPaymentDto {
  /**
   * Human-readable description of why the payment failed.
   *
   * @example 'Card declined — insufficient funds'
   * @maxLength 500
   */
  @ApiPropertyOptional({ example: 'Card declined — insufficient funds' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /**
   * Raw structured response payload returned by the payment gateway.
   * Stored as-is for audit trails and debugging; no specific schema is enforced.
   */
  @ApiPropertyOptional({ description: 'Raw gateway failure payload' })
  @IsOptional()
  gatewayResponse?: Record<string, unknown>;
}
