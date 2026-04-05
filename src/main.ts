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

/**
 * Application bootstrap function.
 *
 * Responsibilities:
 *  - Creates the NestJS application instance with Winston logger.
 *  - Applies security middleware (Helmet, compression, CORS).
 *  - Enables weak ETags for conditional GET support.
 *  - Configures URI-based API versioning with a global `/api` prefix.
 *  - Registers global ValidationPipe, exception filters, and interceptors.
 *  - Mounts the Swagger UI at `/api/docs` in non-production environments.
 *  - Enables graceful shutdown hooks and tunes keep-alive timeouts.
 */
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
      .setDescription(
        '## Overview\n' +
        'REST API for managing salon queues, appointments, staff, and analytics.\n\n' +
        '## Authentication\n' +
        'All protected endpoints require a **Bearer token** in the `Authorization` header.\n' +
        'Use `POST /api/v1/auth/login` to obtain tokens, then click **Authorize** above.\n\n' +
        '## Response envelope\n' +
        'Every response is wrapped by the transform interceptor:\n' +
        '```json\n' +
        '{ "success": true, "statusCode": 200, "data": { ... }, "timestamp": "..." }\n' +
        '```\n' +
        'Error responses include `requestId` for support correlation.',
      )
      .setVersion('1.0')
      // ── Auth scheme ──────────────────────────────────────────────────────
      .addBearerAuth(
        {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Paste the access token returned by POST /auth/login or POST /auth/refresh.',
        },
        'bearer',
      )
      // ── Servers ───────────────────────────────────────────────────────────
      .addServer(`http://localhost:${configService.get<number>('app.port') ?? 3000}`, 'Local')
      // ── Tag groups (order defines the sidebar order in Swagger UI) ────────
      .addTag('Auth',          'Registration, login, token rotation, and password management.')
      .addTag('Users',         'User accounts — profile, admin CRUD, and account status.')
      .addTag('Salons',        'Salon registration, verification workflow, and management.')
      .addTag('Barbers',       'Barber profiles, availability, and service assignments.')
      .addTag('Services',      'Service catalog — pricing, duration, and barber assignments.')
      .addTag('Queue',         'Daily queue lifecycle: open, join, call-next, complete, close.')
      .addTag('Appointments',  'Scheduled appointments — booking, cancellation, and staff view.')
      .addTag('Payments',      'Payment records, offline/online confirmation, and refunds.')
      .addTag('Reviews',       'Customer reviews, owner replies, and moderation.')
      .addTag('Notifications', 'In-app notification inbox — read, count, and delete.')
      .addTag('Analytics',     'Revenue, customer trends, and salon performance reports.')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,       // keep token after page refresh
        docExpansion:         'none',     // collapse all groups on load
        filter:               true,       // show the search box
        tryItOutEnabled:      true,       // open "Try it out" by default
        displayRequestDuration: true,     // show how long each request took
        tagsSorter:           'original', // respect the order from addTag()
        operationsSorter:     'method',   // GET → POST → PUT/PATCH → DELETE
      },
      customSiteTitle: 'Saloon API Docs',
    });
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
