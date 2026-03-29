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

export class CreateAppointmentDto {
  @ApiProperty({ example: 'uuid-of-salon' })
  @IsUUID()
  salonId: string;

  @ApiPropertyOptional({ example: 'uuid-of-staff' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 180 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(5)
  @Max(180)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Haircut' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
