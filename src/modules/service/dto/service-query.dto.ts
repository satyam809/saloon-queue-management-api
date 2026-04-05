import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query parameters DTO for listing services via `GET /services`.
 *
 * Extends {@link PaginationDto} to inherit `page`, `limit`, `skip`, and
 * related pagination fields. All filter and sort properties are optional;
 * when omitted the endpoint returns all non-deleted services ordered by
 * `sortOrder ASC`.
 *
 * Unprivileged callers (customers and unauthenticated requests) only
 * receive active services regardless of the `isActive` filter.
 */
export class ServiceQueryDto extends PaginationDto {
  /**
   * Restrict results to services belonging to the specified salon.
   *
   * @example 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   */
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  /**
   * Case-insensitive partial match applied to the service's `name` field.
   *
   * @example 'haircut'
   */
  @ApiPropertyOptional({ description: 'Search by name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * Filter services by category using a case-insensitive exact match.
   * Maximum 80 characters.
   *
   * @example 'Hair'
   */
  @ApiPropertyOptional({ description: 'Filter by category (exact, case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  /**
   * Filter services by their active status.
   *
   * Query-string values are coerced: the string `'true'` maps to `true`.
   * Only privileged roles (SUPER_ADMIN, SALON_OWNER, STAFF, ONBOARDING_STAFF)
   * may use this filter; unprivileged callers always see only active services.
   */
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  /**
   * Column by which the result set should be sorted.
   *
   * @default 'sortOrder'
   */
  @ApiPropertyOptional({ enum: ['name', 'price', 'durationMinutes', 'sortOrder', 'createdAt'], default: 'sortOrder' })
  @IsOptional()
  @IsIn(['name', 'price', 'durationMinutes', 'sortOrder', 'createdAt'])
  sortBy?: 'name' | 'price' | 'durationMinutes' | 'sortOrder' | 'createdAt';

  /**
   * Direction of the sort applied to {@link sortBy}.
   *
   * @default 'ASC'
   */
  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
