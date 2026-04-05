import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new daily queue.
 *
 * A queue is a date-scoped waiting list tied to a specific salon.
 * Only one active queue per salon per date should exist at any time.
 */
export class CreateQueueDto {
  /**
   * UUID of the salon for which the queue is being created.
   *
   * @example 'uuid-of-salon'
   */
  @ApiProperty({ example: 'uuid-of-salon' })
  @IsUUID()
  salonId: string;

  /**
   * Calendar date the queue is valid for, in ISO 8601 date format (YYYY-MM-DD).
   *
   * @example '2026-03-29'
   */
  @ApiProperty({ example: '2026-03-29' })
  @IsNotEmpty()
  @IsDateString()
  date: string;
}
