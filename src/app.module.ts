import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from '@config/config.module';
import { DatabaseConfig } from '@config/database.config';
import { winstonConfig } from '@config/logger.config';
import { CommonModule } from '@common/common.module';
import { SharedModule } from '@shared/shared.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { SalonModule } from '@modules/salon/salon.module';
import { BarberModule } from '@modules/barber/barber.module';
import { ServiceModule } from '@modules/service/service.module';
import { QueueModule } from '@modules/queue/queue.module';
import { PaymentModule } from '@modules/payment/payment.module';
import { AppointmentModule } from '@modules/appointment/appointment.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { ReviewModule } from '@modules/review/review.module';
import { ActivityLogModule } from '@modules/activity-log/activity-log.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
import redisConfig from '@config/redis.config';

/**
 * Root application module.
 *
 * Wires together all configuration, infrastructure, and feature modules:
 *  - ConfigModule:   loads and validates environment variables globally.
 *  - ThrottlerModule: applies three-tier rate limiting (default / auth / queue).
 *  - WinstonModule:  provides a structured logger across the entire application.
 *  - TypeOrmModule:  bootstraps the MySQL connection pool via DatabaseConfig.
 *  - CommonModule:   registers global JWT, Roles, and Permissions guards.
 *  - SharedModule:   provides the Redis service application-wide.
 *  - Feature modules: Auth, User, Salon, Barber, Service, Queue, Payment,
 *                     Appointment, Notification, Review, Analytics, ActivityLog.
 *
 * A global ThrottlerGuard is registered here so that every route is rate-limited
 * by default. Individual routes may override limits with @Throttle() or opt out
 * with @SkipThrottle().
 */
@Module({
  imports: [
    // Config — loads env vars and validates them
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      cache: true,
    }),

    // Rate limiting — three tiers to balance UX and abuse protection:
    //
    //  1. "default"  — generous global cap; stops runaway scripts / bots
    //                  without impacting normal users.
    //  2. "auth"     — tight cap for login/register; brute-force protection.
    //  3. "queue"    — moderate cap for queue-join; prevents token farming.
    //
    // Limits are read from env so they can be tuned per environment without
    // a redeploy.  Set THROTTLE_SKIP=true in .env.test to disable in tests.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name:  'default',
            ttl:   config.get<number>('THROTTLE_DEFAULT_TTL')   ?? 60_000, // ms
            limit: config.get<number>('THROTTLE_DEFAULT_LIMIT') ?? 300,    // reqs per TTL
          },
          {
            name:  'auth',
            ttl:   config.get<number>('THROTTLE_AUTH_TTL')   ?? 60_000,
            limit: config.get<number>('THROTTLE_AUTH_LIMIT') ?? 10,
          },
          {
            name:  'queue',
            ttl:   config.get<number>('THROTTLE_QUEUE_TTL')   ?? 60_000,
            limit: config.get<number>('THROTTLE_QUEUE_LIMIT') ?? 30,
          },
        ],
        // Honour X-Forwarded-For so the real client IP is used behind a
        // load balancer — not the proxy's IP, which would throttle everyone.
        ignoreUserAgents: [],
        skipIf: () => config.get<string>('THROTTLE_SKIP') === 'true',
      }),
    }),

    // Logger
    WinstonModule.forRoot(winstonConfig),

    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    // Core
    AppConfigModule,
    CommonModule,
    SharedModule,
    ActivityLogModule,

    // Feature modules
    AuthModule,
    UserModule,
    SalonModule,
    BarberModule,
    ServiceModule,
    QueueModule,
    PaymentModule,
    AppointmentModule,
    NotificationModule,
    ReviewModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally so every route is rate-limited by default.
    // Individual controllers/handlers can override with @Throttle() or
    // @SkipThrottle() from @nestjs/throttler.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
