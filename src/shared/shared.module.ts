import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';

/**
 * Shared NestJS module that exposes cross-cutting infrastructure services to
 * every other module in the application.
 *
 * The `@Global()` decorator removes the need for feature modules to import
 * `SharedModule` individually — NestJS makes all exports available
 * application-wide once this module is imported in the root `AppModule`.
 *
 * **Provided services**
 * - {@link RedisService} — Encapsulates the Redis client and provides
 *   caching, pub/sub, and distributed-lock helpers used across the API.
 *
 * @example
 * // app.module.ts
 * @Module({ imports: [SharedModule, ...featureModules] })
 * export class AppModule {}
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class SharedModule {}
