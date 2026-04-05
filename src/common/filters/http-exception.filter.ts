import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Exception filter scoped exclusively to {@link HttpException} instances.
 *
 * NestJS built-in exceptions (`NotFoundException`, `UnauthorizedException`,
 * validation pipe errors, etc.) are all subclasses of `HttpException` and
 * will be intercepted here.  The filter:
 *
 * 1. Extracts the HTTP status code and response body from the exception.
 * 2. Emits a structured **warning** log entry (not an error, because these are
 *    expected operational conditions rather than bugs).
 * 3. Spreads the exception response into a consistent JSON envelope so that
 *    validation error arrays produced by the `ValidationPipe` are preserved
 *    alongside the standard fields.
 *
 * Register this filter **before** {@link AllExceptionsFilter} in the
 * application bootstrap so it takes precedence for HTTP exceptions.
 *
 * @example
 * // main.ts
 * app.useGlobalFilters(
 *   new HttpExceptionFilter(logger),
 *   new AllExceptionsFilter(logger),
 * );
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Creates an instance of {@link HttpExceptionFilter}.
   *
   * @param logger - A NestJS-compatible logger used to emit structured warning
   *   log entries for every caught {@link HttpException}.
   */
  constructor(private readonly logger: LoggerService) {}

  /**
   * Handles an {@link HttpException} by logging contextual request metadata
   * and returning a structured JSON error response.
   *
   * When the exception response body is a plain string it is normalised into
   * an object `{ message }` before being spread into the response envelope,
   * ensuring a consistent output shape for all clients.
   *
   * @param exception - The caught {@link HttpException} (or any subclass).
   * @param host - The NestJS arguments host providing access to the underlying
   *   Express {@link Request} and {@link Response} objects.
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const res      = ctx.getResponse<Response>();
    const req      = ctx.getRequest<Request & { requestId?: string; user?: { id?: string | number } }>();
    const status   = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const requestId = req.requestId ?? 'unknown';
    const userId    = req.user?.id  ?? 'anon';

    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as object);

    this.logger.warn(
      {
        message:   `HTTP ${status} - ${req.method} ${req.url}`,
        requestId,
        userId,
        ip:        req.ip,
        userAgent: req.headers['user-agent'] ?? 'unknown',
        statusCode: status,
      },
      'HttpExceptionFilter',
    );

    res.status(status).json({
      success:    false,
      statusCode: status,
      requestId,
      timestamp:  new Date().toISOString(),
      path:       req.url,
      ...error,
    });
  }
}
