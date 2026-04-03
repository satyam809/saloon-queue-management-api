import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

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
