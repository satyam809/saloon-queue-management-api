import { registerAs } from '@nestjs/config';

/**
 * JWT configuration namespace (`jwt.*`).
 *
 * Values are resolved from environment variables with insecure defaults
 * that must be overridden in production:
 *  - `JWT_SECRET`             → `jwt.secret`          (access token signing key)
 *  - `JWT_EXPIRES_IN`         → `jwt.expiresIn`        (default: `"7d"`)
 *  - `JWT_REFRESH_SECRET`     → `jwt.refreshSecret`   (refresh token signing key)
 *  - `JWT_REFRESH_EXPIRES_IN` → `jwt.refreshExpiresIn` (default: `"30d"`)
 *
 * @warning The default secret values are placeholders only.
 *          Always set strong secrets via environment variables in production.
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'change-me-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
}));
