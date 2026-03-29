import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  LoggerService,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, ip } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const statusCode = context.switchToHttp().getResponse().statusCode;
          this.logger.log(
            `${method} ${url} ${statusCode} ${ms}ms - ${ip}`,
            'HTTP',
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.error(
            `${method} ${url} ${err.status ?? 500} ${ms}ms - ${ip}`,
            err.stack,
            'HTTP',
          );
        },
      }),
    );
  }
}
