import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Granularity options that control how time-series analytics data is bucketed.
 *
 * - `DAILY`   — one data point per calendar day.
 * - `WEEKLY`  — one data point per ISO calendar week.
 * - `MONTHLY` — one data point per calendar month.
 */
export enum Granularity {
  DAILY   = 'daily',
  WEEKLY  = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Query parameters shared across all analytics endpoints.
 *
 * Controls the time window, time-series bucket size, and optional salon scope
 * applied to analytic computations. All fields are optional — sensible defaults
 * (last 30 days, daily granularity, all salons) are applied by the service when
 * a field is omitted.
 */
export class AnalyticsQueryDto {
  /**
   * Inclusive start of the date range used for the analytics calculation.
   * Must be a valid ISO 8601 date string (e.g. `2026-01-01`).
   * Defaults to 30 days before the current date when omitted.
   */
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Range start (inclusive). Defaults to 30 days ago.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Inclusive end of the date range used for the analytics calculation.
   * Must be a valid ISO 8601 date string (e.g. `2026-03-31`).
   * Defaults to today's date when omitted.
   */
  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'Range end (inclusive). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Size of each time-series bucket.
   * Must be one of the {@link Granularity} enum values.
   * Defaults to {@link Granularity.DAILY} when omitted.
   */
  @ApiPropertyOptional({
    enum: Granularity,
    default: Granularity.DAILY,
    description: 'Bucket size for time-series data.',
  })
  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity;

  /**
   * UUID of the salon to scope results to.
   * When provided, the analytics engine filters data to that salon only.
   * Required by endpoints that support barber or service-level breakdowns.
   */
  @ApiPropertyOptional({
    description: 'Scope results to a specific salon. Required for barber/service breakdowns.',
  })
  @IsOptional()
  @IsUUID()
  salonId?: string;
}
