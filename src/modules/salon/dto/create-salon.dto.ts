import {
  IsEmail,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export class WorkingHoursSlotDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  open: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @IsNotEmpty()
  close: string;
}

export class CreateSalonDto {
  // ─── Core identity ──────────────────────────────────────────────────────

  @ApiProperty({ example: 'The Style Studio' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Premium cuts in a relaxing atmosphere.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // ─── Location ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '123 Main Street, Suite 4' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'US', default: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -74.006 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  // ─── Contact ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '+12125551234' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@thestylestudio.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  // ─── Media ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  // ─── Business config ────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(180)
  avgServiceDurationMinutes?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxQueueSize?: number;

  /**
   * Map of day abbreviation → slot (or null for closed).
   * Example: { "mon": { "open": "09:00", "close": "18:00" }, "sun": null }
   */
  @ApiPropertyOptional({
    description: 'Working hours per day. Omit a day or set null to mark it closed.',
    example: { mon: { open: '09:00', close: '18:00' }, sun: null },
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<DayOfWeek, WorkingHoursSlotDto | null>;

  @ApiPropertyOptional({ example: 'America/New_York', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
