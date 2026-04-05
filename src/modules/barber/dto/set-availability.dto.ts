import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for toggling a barber's availability status.
 *
 * Used by the `PATCH /barbers/:id/availability` endpoint. Setting
 * `isAvailable` to `true` marks the barber as ready to accept new
 * customers; `false` marks them as unavailable (e.g. on break or
 * at capacity).
 */
export class SetAvailabilityDto {
  /**
   * Desired availability state for the barber.
   *
   * - `true`  — barber is available to accept customers.
   * - `false` — barber is currently unavailable.
   *
   * @example true
   */
  @ApiProperty({
    example: true,
    description: 'true = barber is available to accept customers; false = unavailable',
  })
  @IsBoolean()
  isAvailable: boolean;
}
