import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateAppointmentDto } from './create-appointment.dto';
import { AppointmentStatus } from '@common/enums/status.enum';

/**
 * Data Transfer Object for updating an existing appointment.
 *
 * Extends {@link CreateAppointmentDto} via `PartialType`, making every field
 * from the creation DTO optional. Adds an additional `status` field that
 * allows authorised staff to transition the appointment through its lifecycle
 * states (e.g. SCHEDULED → CONFIRMED → COMPLETED).
 */
export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  /**
   * New lifecycle status to apply to the appointment.
   * Must be a valid {@link AppointmentStatus} value.
   * When omitted, the status is left unchanged.
   */
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
