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

/** Valid abbreviated day-of-week keys used in working hours configuration. */
const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Union type of the seven abbreviated day-of-week keys. */
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/**
 * Represents a single day's opening and closing times.
 *
 * Times are expressed as `HH:MM` strings in 24-hour format.
 * Set the parent map entry to `null` to mark the salon as closed on that day.
 */
export class WorkingHoursSlotDto {
  /** Opening time in 24-hour `HH:MM` format (e.g. `'09:00'`). */
  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  open: string;

  /** Closing time in 24-hour `HH:MM` format (e.g. `'18:00'`). */
  @ApiProperty({ example: '18:00' })
  @IsString()
  @IsNotEmpty()
  close: string;
}

/**
 * Request body for creating a new salon.
 *
 * Only `name` is required. All location, contact, media, and business-config
 * fields are optional and will be stored as `null` when omitted.
 */
export class CreateSalonDto {
  // ─── Core identity ──────────────────────────────────────────────────────

  /** Human-readable name of the salon (required, max 150 characters). */
  @ApiProperty({ example: 'The Style Studio' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  /** Optional marketing description of the salon (max 2000 characters). */
  @ApiPropertyOptional({ example: 'Premium cuts in a relaxing atmosphere.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // ─── Location ───────────────────────────────────────────────────────────

  /** Street address including suite/unit if applicable. */
  @ApiPropertyOptional({ example: '123 Main Street, Suite 4' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /** City name. */
  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** State or province abbreviation / name. */
  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  /** ISO country code (defaults to `'US'` when omitted). */
  @ApiPropertyOptional({ example: 'US', default: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  /** Postal / ZIP code. */
  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  /** Geographic latitude (validated as a valid latitude value). */
  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  /** Geographic longitude (validated as a valid longitude value). */
  @ApiPropertyOptional({ example: -74.006 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  // ─── Contact ────────────────────────────────────────────────────────────

  /** Contact phone number in E.164 format (e.g. `'+12125551234'`). */
  @ApiPropertyOptional({ example: '+12125551234' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  /** Public contact email address (max 150 characters). */
  @ApiPropertyOptional({ example: 'info@thestylestudio.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  // ─── Media ──────────────────────────────────────────────────────────────

  /** Publicly accessible URL of the salon's logo image. */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  /** Publicly accessible URL of the salon's cover/banner image. */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  // ─── Business config ────────────────────────────────────────────────────

  /**
   * Default service duration in minutes used when no service-specific duration
   * is defined. Must be between 5 and 180 minutes (defaults to 30).
   */
  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(180)
  avgServiceDurationMinutes?: number;

  /**
   * Maximum number of customers allowed in the active queue at any one time.
   * Must be between 1 and 200 (defaults to 20).
   */
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

  /**
   * IANA timezone identifier used to interpret working hours
   * (e.g. `'America/New_York'`). Defaults to `'UTC'`.
   */
  @ApiPropertyOptional({ example: 'America/New_York', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
