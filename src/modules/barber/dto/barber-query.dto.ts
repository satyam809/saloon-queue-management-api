import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';
import { BarberStatus } from '@common/enums/status.enum';

/**
 * Query parameters DTO for listing barbers via `GET /barbers`.
 *
 * Extends {@link PaginationDto} to inherit `page`, `limit`, `skip`, and
 * related pagination fields. All filter and sort properties are optional;
 * when omitted the endpoint returns all non-deleted barbers in the default
 * sort order (`name ASC`).
 */
export class BarberQueryDto extends PaginationDto {
  /**
   * Restrict results to barbers belonging to the specified salon.
   *
   * @example 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   */
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  /**
   * Case-insensitive partial match applied to the barber's `name` field.
   *
   * @example 'John'
   */
  @ApiPropertyOptional({ description: 'Search by name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * Filter barbers by their current status (e.g. `ACTIVE`, `INACTIVE`).
   */
  @ApiPropertyOptional({ enum: BarberStatus })
  @IsOptional()
  @IsIn(Object.values(BarberStatus))
  status?: BarberStatus;

  /**
   * When `true`, return only barbers who are currently accepting customers.
   * When `false`, return only unavailable barbers.
   * Omit to return barbers regardless of availability.
   *
   * Query-string values are coerced: the string `'true'` maps to `true`.
   */
  @ApiPropertyOptional({ description: 'Filter by availability' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isAvailable?: boolean;

  /**
   * Column by which the result set should be sorted.
   *
   * @default 'name'
   */
  @ApiPropertyOptional({ enum: ['name', 'rating', 'createdAt'], default: 'name' })
  @IsOptional()
  @IsIn(['name', 'rating', 'createdAt'])
  sortBy?: 'name' | 'rating' | 'createdAt';

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
