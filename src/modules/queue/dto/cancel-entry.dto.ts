import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for cancelling a queue entry.
 *
 * Carries the optional human-readable reason a customer or staff member
 * supplies when removing an entry from the waiting queue.
 */
export class CancelEntryDto {
  /**
   * Optional plain-text explanation for why the queue entry is being cancelled.
   *
   * @example 'Customer left without being served'
   * @maxLength 255
   */
  @ApiPropertyOptional({ example: 'Customer left without being served' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
