import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new appointment.
 *
 * Captures all fields a customer must (or optionally may) provide when booking
 * a salon appointment, including timing, preferred staff member, and service details.
 */
export class CreateAppointmentDto {
  /**
   * UUID of the salon where the appointment should be booked.
   *
   * @example 'uuid-of-salon'
   */
  @ApiProperty({ example: 'uuid-of-salon' })
  @IsUUID()
  salonId: string;

  /**
   * UUID of the preferred staff member (barber/stylist) to serve the customer.
   * When omitted, no specific staff member is assigned.
   *
   * @example 'uuid-of-staff'
   */
  @ApiPropertyOptional({ example: 'uuid-of-staff' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  /**
   * Desired start time for the appointment in ISO 8601 format.
   * Must be a future timestamp; the system will reject past values.
   *
   * @example '2026-03-29T10:00:00.000Z'
   */
  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  /**
   * Length of the appointment in minutes.
   * Defaults to 30 when omitted. Must be between 5 and 180 inclusive.
   *
   * @default 30
   * @minimum 5
   * @maximum 180
   */
  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 180 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(5)
  @Max(180)
  durationMinutes?: number;

  /**
   * Human-readable label describing the type of service requested.
   *
   * @example 'Haircut'
   */
  @ApiPropertyOptional({ example: 'Haircut' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  /**
   * Optional free-text notes or special requests from the customer.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
