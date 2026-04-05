import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { SalonStatus } from '@common/enums/status.enum';

/**
 * Query parameters accepted by the list-salons endpoint (`GET /salons`).
 *
 * Extends {@link PaginationDto} to include `page` and `limit` support.
 * All fields are optional.
 */
export class SalonQueryDto extends PaginationDto {
  /**
   * Partial name match (case-insensitive `LIKE` search).
   * When provided, only salons whose names contain this string are returned.
   */
  @ApiPropertyOptional({ description: 'Search by name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * Filter results to a specific {@link SalonStatus}.
   * Only admins and onboarding staff may use this filter; public callers
   * always see ACTIVE salons regardless of this value.
   */
  @ApiPropertyOptional({ enum: SalonStatus, description: 'Filter by salon status' })
  @IsOptional()
  @IsIn(Object.values(SalonStatus))
  status?: SalonStatus;

  /**
   * Partial city name filter (case-insensitive `LIKE` search).
   * When provided, only salons located in matching cities are returned.
   */
  @ApiPropertyOptional({ description: 'Filter by city name (exact, case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /**
   * Column to sort results by. Defaults to `'createdAt'`.
   */
  @ApiPropertyOptional({
    enum: ['name', 'city', 'createdAt', 'verifiedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'city', 'createdAt', 'verifiedAt'])
  sortBy?: 'name' | 'city' | 'createdAt' | 'verifiedAt';

  /**
   * Sort direction. Defaults to `'DESC'`.
   */
  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
