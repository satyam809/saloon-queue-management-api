import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that catches **every** unhandled exception,
 * including non-HTTP errors such as database failures, type errors, and
 * third-party library exceptions.
 *
 * When an exception is caught the filter:
 * 1. Determines the appropriate HTTP status code (falls back to `500` for
 *    non-{@link HttpException} errors).
 * 2. Logs a structured error record — including the request ID, user ID, IP
 *    address, and user-agent — via the injected {@link LoggerService}.
 * 3. Returns a consistent JSON error envelope so that API clients always
 *    receive a machine-readable response regardless of error origin.
 *
 * This filter should be registered **after** {@link HttpExceptionFilter} in
 * the application bootstrap so that HTTP exceptions are handled by the more
 * specific filter first.
 *
 * @example
 * // main.ts
 * app.useGlobalFilters(
 *   new HttpExceptionFilter(logger),
 *   new AllExceptionsFilter(logger),
 * );
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /**
   * Creates an instance of {@link AllExceptionsFilter}.
   *
   * @param logger - A NestJS-compatible logger used to record structured error
   *   details for every caught exception.
   */
  constructor(private readonly logger: LoggerService) {}

  /**
   * Handles any exception that has not already been processed by a more
   * specific filter.
   *
   * The method extracts contextual metadata from the HTTP request (request ID,
   * user ID, IP, user-agent), emits a structured error log entry, and sends a
   * uniform JSON error response to the client.
   *
   * @param exception - The caught exception.  May be an {@link HttpException},
   *   a generic `Error`, or any other thrown value.
   * @param host - The NestJS arguments host used to retrieve the underlying
   *   Express {@link Request} and {@link Response} objects.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string; user?: { id?: string | number } }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const requestId = req.requestId ?? 'unknown';
    const userId    = req.user?.id  ?? 'anon';

    this.logger.error(
      {
        message:   `Unhandled exception: ${message}`,
        requestId,
        userId,
        ip:        req.ip,
        userAgent: req.headers['user-agent'] ?? 'unknown',
        statusCode: status,
      },
      exception instanceof Error ? exception.stack : String(exception),
      'AllExceptionsFilter',
    );

    res.status(status).json({
      success:    false,
      statusCode: status,
      requestId,
      timestamp:  new Date().toISOString(),
      path:       req.url,
      message,
    });
  }
}
