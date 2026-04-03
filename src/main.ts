import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from '@common/interceptors/timeout.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  const isDev = configService.get<string>('app.env') !== 'production';

  app.useLogger(logger);

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    compression({
      // Only compress responses larger than 1 KB — below that, the CPU cost
      // of compression exceeds the bandwidth saving.
      threshold: 1024,
      // Prefer brotli (level 4) when the client supports it; fall back to
      // gzip (level 6).  brotli typically achieves 15–20 % better ratios
      // than gzip for JSON payloads.
      brotli: { params: { [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4 } },
      level: 6,
    }),
  );
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
  });

  // ─── ETag support ──────────────────────────────────────────────────────────
  // Enables conditional GET (If-None-Match) so repeat polls of stable
  // responses (e.g. getLiveState cache hits) return 304 Not Modified, saving
  // bandwidth and reducing time-to-first-byte for the client.
  app.getHttpAdapter().getInstance().set('etag', 'weak');

  // ─── Routing ───────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ─── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global filters ────────────────────────────────────────────────────────
  app.useGlobalFilters(
    new AllExceptionsFilter(logger),
    new HttpExceptionFilter(logger),
  );

  // ─── Global interceptors ───────────────────────────────────────────────────
  // Order matters: Logging wraps everything; Timeout kills stalled handlers
  // before Transform tries to serialise a partial result.
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new TimeoutInterceptor(30_000),   // 30 s hard cap on every request
    new TransformInterceptor(),
  );

  // ─── Swagger (non-production only) ─────────────────────────────────────────
  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('Saloon Queue Management API')
      .setDescription('Production-grade API for managing saloon queues')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ─── Graceful shutdown ─────────────────────────────────────────────────────
  // Intercepts SIGTERM/SIGINT so the process drains in-flight requests before
  // closing DB/Redis connections, instead of hard-killing mid-transaction.
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port') ?? 3000;
  const server = await app.listen(port);

  // Give the OS 30 s to deliver SIGTERM before the process exits.
  // Aligns with Kubernetes' default terminationGracePeriodSeconds = 30.
  server.keepAliveTimeout  = 65_000; // ms — must exceed ALB/nginx idle timeout
  server.headersTimeout    = 66_000; // ms — slightly above keepAliveTimeout

  logger.log(`Application running on port ${port}`, 'Bootstrap');
}

bootstrap();
