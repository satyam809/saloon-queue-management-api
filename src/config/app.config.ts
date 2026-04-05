import { registerAs } from '@nestjs/config';

/**
 * Application-level configuration namespace (`app.*`).
 *
 * Values are resolved from environment variables with safe defaults:
 *  - `NODE_ENV`    → `app.env`        (default: `"development"`)
 *  - `PORT`        → `app.port`       (default: `3000`)
 *  - `CORS_ORIGIN` → `app.corsOrigin` (default: `"*"`)
 *
 * Inject with `ConfigService.get<string>('app.env')`, etc.
 */
export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
}));
