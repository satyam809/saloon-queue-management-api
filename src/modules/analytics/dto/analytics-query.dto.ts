import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum Granularity {
  DAILY   = 'daily',
  WEEKLY  = 'weekly',
  MONTHLY = 'monthly',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Range start (inclusive). Defaults to 30 days ago.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'Range end (inclusive). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: Granularity,
    default: Granularity.DAILY,
    description: 'Bucket size for time-series data.',
  })
  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity;

  @ApiPropertyOptional({
    description: 'Scope results to a specific salon. Required for barber/service breakdowns.',
  })
  @IsOptional()
  @IsUUID()
  salonId?: string;
}
