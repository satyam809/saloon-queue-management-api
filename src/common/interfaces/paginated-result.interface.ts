/**
 * Generic wrapper returned by any service method or repository query that
 * supports pagination.
 *
 * Pairing the data payload with a `meta` object keeps the response
 * self-describing: the caller receives everything needed to render a paginated
 * list (items, current page, total pages, etc.) in a single response without
 * additional requests.
 *
 * The type parameter `T` represents the shape of a single item in the result
 * set, keeping the interface reusable across every resource in the API.
 *
 * @template T - The entity or DTO type for a single result row.
 *
 * @example
 * const result: PaginatedResult<AppointmentDto> = {
 *   data: [...],
 *   meta: { total: 150, page: 2, limit: 20, totalPages: 8 },
 * };
 */
export interface PaginatedResult<T> {
  /**
   * The slice of records for the requested page.
   * The array length is at most `meta.limit`.
   */
  data: T[];

  /**
   * Pagination metadata describing the full result set and the current
   * position within it.
   */
  meta: {
    /**
     * The total number of records matching the query across all pages.
     * Used to calculate {@link totalPages} and to display record counts in the UI.
     */
    total: number;

    /**
     * The 1-based page number that was returned.
     * Matches the `page` value from the originating {@link PaginationDto}.
     */
    page: number;

    /**
     * The maximum number of records per page that was requested.
     * Matches the `limit` value from the originating {@link PaginationDto}.
     */
    limit: number;

    /**
     * The total number of pages available, calculated as
     * `Math.ceil(total / limit)`.  A value of `0` indicates an empty result set.
     */
    totalPages: number;
  };
}
