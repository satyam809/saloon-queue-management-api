import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Global guard chain — applied to every route in the application.
 * Order matters: NestJS executes APP_GUARD providers in registration order.
 *
 *  1. JwtAuthGuard     — verifies the Bearer token; populates req.user
 *  2. RolesGuard       — enforces @Roles() restrictions
 *  3. PermissionsGuard — enforces @RequirePermissions() restrictions
 *
 * Routes decorated with @Public() skip all three guards.
 * SUPER_ADMIN bypasses guards 2 and 3.
 */
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class CommonModule {}
