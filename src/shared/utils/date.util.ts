/**
 * Adds a number of minutes to a given date and returns the resulting date.
 *
 * The original `date` object is **not** mutated; a new `Date` instance is
 * always returned.  This is useful for computing appointment end-times,
 * reminder trigger times, and queue-slot deadlines.
 *
 * @param date    - The base date/time from which to add minutes.
 * @param minutes - The number of minutes to add.  May be negative to subtract
 *   time, or zero to clone the date.
 * @returns A new `Date` instance representing `date + minutes`.
 *
 * @example
 * const start = new Date('2026-04-05T10:00:00Z');
 * const end   = addMinutes(start, 45);
 * // end → 2026-04-05T10:45:00.000Z
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Returns `true` if the given date is strictly in the future relative to the
 * current system clock.
 *
 * A date equal to `Date.now()` at the exact millisecond of comparison is
 * considered **not** future (returns `false`).
 *
 * @param date - The date to test.
 * @returns `true` when `date` is after the current timestamp; `false` otherwise.
 *
 * @example
 * isFuture(new Date(Date.now() + 10_000)); // true
 * isFuture(new Date(Date.now() - 10_000)); // false
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Returns `true` if the given date is strictly in the past relative to the
 * current system clock.
 *
 * A date equal to `Date.now()` at the exact millisecond of comparison is
 * considered **not** past (returns `false`).
 *
 * @param date - The date to test.
 * @returns `true` when `date` is before the current timestamp; `false` otherwise.
 *
 * @example
 * isPast(new Date(Date.now() - 10_000)); // true
 * isPast(new Date(Date.now() + 10_000)); // false
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Calculates the number of whole minutes between two dates, rounding to the
 * nearest integer.
 *
 * The result is positive when `end` is after `start`, and negative when `end`
 * is before `start`.  Useful for computing service durations, wait times, and
 * queue-position estimates.
 *
 * @param start - The earlier boundary of the interval.
 * @param end   - The later boundary of the interval.
 * @returns The rounded number of minutes from `start` to `end`.
 *
 * @example
 * const a = new Date('2026-04-05T09:00:00Z');
 * const b = new Date('2026-04-05T09:37:30Z');
 * minutesBetween(a, b); // 38  (37.5 rounds up)
 */
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
