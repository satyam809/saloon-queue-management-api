import { registerAs } from '@nestjs/config';

/**
 * Redis configuration namespace (`redis.*`).
 *
 * Values are resolved from environment variables with safe defaults:
 *  - `REDIS_HOST`     → `redis.host`     (default: `"localhost"`)
 *  - `REDIS_PORT`     → `redis.port`     (default: `6379`)
 *  - `REDIS_PASSWORD` → `redis.password` (default: empty string — no auth)
 *  - `REDIS_TTL`      → `redis.ttl`      (default: `3600` seconds)
 *
 * Consumed by `RedisService` via `ConfigService.get('redis.*')`.
 */
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? '',
  ttl: parseInt(process.env.REDIS_TTL ?? '3600', 10),
}));
