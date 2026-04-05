import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * ReviewQueryDto — query parameters for the paginated review listing endpoint.
 *
 * Extends PaginationDto (page, limit, skip) with review-specific filters
 * and sorting options.
 *
 * Note: `isPublished` filtering is silently ignored for non-admin callers —
 * the service layer enforces that public requests always see only published reviews.
 */
export class ReviewQueryDto extends PaginationDto {
  /** Filter results to reviews for a specific salon UUID. */
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  /** Filter results to reviews submitted by a specific customer UUID. */
  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Filter results to reviews targeting a specific barber UUID. */
  @ApiPropertyOptional({ description: 'Filter by barber UUID' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  /**
   * Filter by exact integer rating (1–5).
   * Coerced from string query param via `@Type(() => Number)`.
   */
  @ApiPropertyOptional({ description: 'Filter by exact rating (1–5)', minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  /**
   * When `true`, returns only reviews with a proven visit (queue entry or appointment).
   * When `false`, returns only unverified reviews.
   * Coerced from string `'true'`/`'false'` query param.
   */
  @ApiPropertyOptional({ description: 'Only return reviews with a proven visit' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVerifiedVisit?: boolean;

  /**
   * Filter by published status.
   * Admin-only filter — non-admin callers always see published reviews regardless of this value.
   * Coerced from string `'true'`/`'false'` query param.
   */
  @ApiPropertyOptional({
    description: 'Filter by published status (admin only — public always sees published reviews)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPublished?: boolean;

  /**
   * Field to sort results by.
   * `'rating'` sorts by star rating; `'createdAt'` sorts by submission date (default).
   */
  @ApiPropertyOptional({ enum: ['rating', 'createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['rating', 'createdAt'])
  sortBy?: 'rating' | 'createdAt';

  /**
   * Sort direction. Defaults to `'DESC'` (newest / highest first).
   */
  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
