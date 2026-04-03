import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

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
