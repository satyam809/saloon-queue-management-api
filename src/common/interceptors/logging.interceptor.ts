import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  LoggerService,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * NestJS interceptor that provides structured HTTP request/response logging
 * with correlation ID propagation.
 *
 * For every incoming request the interceptor:
 * 1. Reads the `x-request-id` header supplied by the caller (e.g. an API
 *    gateway or load balancer) or generates a new UUID v4 if absent.
 * 2. Attaches the request ID to the Express `Request` object so that
 *    downstream services and exception filters can include it in their own
 *    log entries.
 * 3. Echoes the request ID back to the client via the `x-request-id` response
 *    header.
 * 4. On successful completion, emits a structured **info** log entry that
 *    includes the HTTP method, URL, status code, duration, user ID, IP
 *    address, and user-agent.
 * 5. On error, emits a structured **error** log entry with the same fields
 *    plus the exception stack trace.
 *
 * @example
 * // main.ts — register globally
 * app.useGlobalInterceptors(new LoggingInterceptor(logger));
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /**
   * Creates an instance of {@link LoggingInterceptor}.
   *
   * @param logger - A NestJS-compatible logger used to emit structured log
   *   entries for every HTTP request handled by the application.
   */
  constructor(private readonly logger: LoggerService) {}

  /**
   * Intercepts the execution pipeline to attach a correlation ID and emit
   * structured log entries when the request completes or fails.
   *
   * @param context - The NestJS execution context providing access to the
   *   underlying Express `Request` and `Response` objects.
   * @param next - The call handler whose `handle()` method invokes the next
   *   element in the middleware / handler chain and returns an observable of
   *   the response data.
   * @returns An {@link Observable} that emits the handler's response data and
   *   triggers logging side-effects via the `tap` operator.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Use caller-provided request ID (e.g. from API gateway) or generate one.
    const requestId: string =
      (req.headers['x-request-id'] as string | undefined) ?? uuidv4();

    // Attach to request so filters / services can correlate logs.
    req.requestId = requestId;

    // Echo back so clients can match responses to their request IDs.
    res.setHeader('x-request-id', requestId);

    const { method, url, ip, headers } = req as {
      method:    string;
      url:       string;
      ip:        string;
      headers:   Record<string, string | undefined>;
      user?:     { id?: string | number };
      requestId: string;
    };

    const userAgent = headers['user-agent'] ?? 'unknown';
    const start     = Date.now();

    return next.handle().pipe(
      tap({
        /**
         * Called when the request handler resolves successfully.
         * Emits a structured info-level log entry with timing information.
         */
        next: () => {
          const ms         = Date.now() - start;
          const statusCode = res.statusCode as number;
          const userId     = (req.user as { id?: string | number } | undefined)?.id ?? 'anon';

          this.logger.log(
            {
              message:    `${method} ${url} ${statusCode} ${ms}ms`,
              requestId,
              userId,
              ip,
              userAgent,
              duration:   ms,
              statusCode,
            },
            'HTTP',
          );
        },

        /**
         * Called when the request handler throws or rejects.
         * Emits a structured error-level log entry including the stack trace.
         *
         * @param err - The error thrown by the handler, optionally carrying an
         *   HTTP `status` code.
         */
        error: (err: Error & { status?: number }) => {
          const ms         = Date.now() - start;
          const statusCode = err.status ?? 500;
          const userId     = (req.user as { id?: string | number } | undefined)?.id ?? 'anon';

          this.logger.error(
            {
              message:    `${method} ${url} ${statusCode} ${ms}ms`,
              requestId,
              userId,
              ip,
              userAgent,
              duration:   ms,
              statusCode,
            },
            err.stack,
            'HTTP',
          );
        },
      }),
    );
  }
}
