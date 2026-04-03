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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

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
