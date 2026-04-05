import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard envelope wrapping every successful API response.
 *
 * All controller handlers return raw data; the {@link TransformInterceptor}
 * wraps that data in this interface before it is serialised and sent to the
 * client.  This guarantees a consistent response shape across the entire API,
 * making it straightforward for clients to check `success` and then read
 * `data` without handling per-route response variations.
 *
 * @template T - The type of the actual response payload contained in `data`.
 */
export interface ApiResponse<T> {
  /**
   * Indicates whether the request was handled without an error.
   * Always `true` for responses produced by this interceptor; error responses
   * are shaped by the exception filters instead.
   */
  success: boolean;

  /**
   * The HTTP status code of the response (e.g. `200`, `201`).
   * Mirrors the status code set on the Express `Response` object.
   */
  statusCode: number;

  /**
   * The actual response payload returned by the route handler.
   * May be a single entity object, an array, a paginated result, etc.
   */
  data: T;

  /**
   * ISO 8601 timestamp indicating when the response was generated,
   * e.g. `"2026-04-05T12:00:00.000Z"`.
   */
  timestamp: string;
}

/**
 * NestJS interceptor that wraps every successful controller response in a
 * standard {@link ApiResponse} envelope.
 *
 * By applying this interceptor globally, every endpoint automatically returns
 * a response in the shape `{ success, statusCode, data, timestamp }` without
 * any per-controller boilerplate.  Exception filters handle the equivalent
 * wrapping for error responses.
 *
 * @template T - The type of the raw data emitted by the route handler before
 *   transformation.
 *
 * @example
 * // main.ts — register globally
 * app.useGlobalInterceptors(new TransformInterceptor());
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  /**
   * Intercepts the observable returned by the route handler and maps its
   * emitted value into an {@link ApiResponse} envelope.
   *
   * @param context - The NestJS execution context used to read the HTTP
   *   response status code before the response is sent.
   * @param next - The call handler whose `handle()` method invokes the next
   *   element in the pipeline and returns the raw response observable.
   * @returns An {@link Observable} that emits a single {@link ApiResponse}
   *   wrapping the original handler data.
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
