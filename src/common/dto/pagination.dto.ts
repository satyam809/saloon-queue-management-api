import { IsOptional, IsPositive, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for pagination query parameters.
 *
 * Consumers pass `page` and `limit` as query-string values; the DTO validates
 * and coerces them to numbers via `class-transformer` before they reach a
 * controller or service.  The computed {@link skip} getter provides the offset
 * value that can be passed directly to a TypeORM `find` call or a raw SQL
 * `OFFSET` clause.
 *
 * @example
 * // GET /appointments?page=3&limit=20
 * // → page = 3, limit = 20, skip = 40
 */
export class PaginationDto {
  /**
   * The 1-based page number to retrieve.
   *
   * Defaults to `1` when omitted.  Must be a positive integer greater than or
   * equal to `1`.
   *
   * @default 1
   */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page: number = 1;

  /**
   * The maximum number of records to return per page.
   *
   * Defaults to `10` when omitted.  Capped at `100` to prevent excessive
   * database load from a single request.
   *
   * @default 10
   */
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number = 10;

  /**
   * Computes the zero-based record offset for the requested page.
   *
   * Derived from `(page - 1) * limit` and is suitable for use as the
   * `skip` option in TypeORM repository methods or as a SQL `OFFSET` value.
   *
   * @returns The number of records to skip before the current page.
   *
   * @example
   * const dto = new PaginationDto();
   * dto.page  = 3;
   * dto.limit = 20;
   * console.log(dto.skip); // 40
   */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
