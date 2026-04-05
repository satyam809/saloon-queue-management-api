import { PaginatedResult } from '@common/interfaces/paginated-result.interface';

/**
 * Assembles a {@link PaginatedResult} from raw query output and pagination
 * parameters.
 *
 * Service methods typically issue two database calls: one to fetch the current
 * page of records and one (`COUNT`) to determine the total number of matching
 * rows.  `paginate` combines those two pieces of information with the
 * requested page and limit into the standard {@link PaginatedResult} shape
 * consumed by API clients.
 *
 * The `totalPages` value is calculated as `Math.ceil(total / limit)`, which
 * returns `0` when `total` is `0` (empty result set).
 *
 * @template T - The entity or DTO type for a single result row.
 *
 * @param data  - The slice of records for the current page, as returned by the
 *   repository query.
 * @param total - The total number of records matching the query across all pages
 *   (typically obtained via a `COUNT` query).
 * @param page  - The 1-based page number that was requested.
 * @param limit - The maximum number of records per page that was requested.
 * @returns A {@link PaginatedResult} containing the data slice and pagination
 *   metadata.
 *
 * @example
 * const [records, total] = await this.repo.findAndCount({
 *   skip:  dto.skip,
 *   take:  dto.limit,
 * });
 * return paginate(records, total, dto.page, dto.limit);
 * // → { data: [...], meta: { total, page, limit, totalPages } }
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
