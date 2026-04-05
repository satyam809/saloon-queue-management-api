import { IsNumber, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for assigning a barber to a service.
 *
 * Used by the `POST /services/:id/barbers` endpoint. Beyond the required
 * `barberId`, callers may supply per-barber overrides for price and
 * duration that take precedence over the service-level defaults when
 * scheduling appointments.
 */
export class AssignBarberDto {
  /**
   * UUID of the barber to assign to the service.
   *
   * @example 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   */
  @ApiProperty({ description: 'UUID of the barber to assign to this service' })
  @IsUUID()
  barberId: string;

  /**
   * Optional custom price charged by this specific barber for the service.
   *
   * When set, this value overrides `service.price` for appointments booked
   * with this barber. Must be a positive number with at most two decimal places.
   *
   * @example 20.00
   */
  @ApiPropertyOptional({
    example: 20.00,
    description: 'Custom price for this barber — overrides service.price when set',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  customPrice?: number;

  /**
   * Optional custom duration (in minutes) for this barber's execution of the service.
   *
   * When set, this value overrides `service.durationMinutes` for appointments
   * booked with this barber. Valid range is 5–480 minutes.
   *
   * @example 25
   */
  @ApiPropertyOptional({
    example: 25,
    description: 'Custom duration (minutes) for this barber — overrides service.durationMinutes when set',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(480)
  customDuration?: number;
}
