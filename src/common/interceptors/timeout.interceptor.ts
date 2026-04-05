import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * NestJS interceptor that enforces a maximum response time for every request.
 *
 * If the downstream handler does not emit a value within the configured
 * {@link timeoutMs} window, RxJS raises a {@link TimeoutError} which this
 * interceptor converts into NestJS's `RequestTimeoutException` (HTTP 408).
 * Any other error propagated by the handler is re-thrown unchanged.
 *
 * The timeout duration is injected via the constructor so that it can be
 * customised per-route by creating separate interceptor instances, or applied
 * globally with a single shared value.
 *
 * @example
 * // Apply globally with the default 30-second limit:
 * app.useGlobalInterceptors(new TimeoutInterceptor());
 *
 * @example
 * // Apply per-controller with a 5-second limit:
 * @UseInterceptors(new TimeoutInterceptor(5000))
 * export class AppointmentsController {}
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  /**
   * Creates an instance of {@link TimeoutInterceptor}.
   *
   * @param timeoutMs - The maximum number of milliseconds to wait for the
   *   request handler to respond.  Defaults to `30000` (30 seconds).
   */
  constructor(private readonly timeoutMs: number = 30000) {}

  /**
   * Applies a timeout window to the request handler observable.
   *
   * If the handler does not emit within {@link timeoutMs} milliseconds,
   * the observable errors with a {@link TimeoutError}, which is caught here
   * and converted to a `RequestTimeoutException` (HTTP 408).  All other
   * errors are passed through unmodified.
   *
   * @param _context - The NestJS execution context (unused; present to satisfy
   *   the {@link NestInterceptor} interface).
   * @param next - The call handler providing the inner observable of the
   *   downstream route handler's response.
   * @returns An {@link Observable} that completes with the handler's data or
   *   errors with a `RequestTimeoutException` if the deadline is exceeded.
   */
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
