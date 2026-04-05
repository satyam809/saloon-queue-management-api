import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard`
 * to detect routes that should skip authentication entirely.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route handler (or an entire controller) as publicly accessible.
 *
 * When applied, `JwtAuthGuard` will not require a Bearer token, and the
 * downstream `RolesGuard` / `PermissionsGuard` will also pass through.
 *
 * @example
 * @Public()
 * @Get('health')
 * getHealth() {}
 *
 * // Applied to a whole controller:
 * @Public()
 * @Controller('auth')
 * export class AuthController {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
