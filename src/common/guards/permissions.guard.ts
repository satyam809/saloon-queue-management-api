import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '@common/decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { canPerformAll, getPermissionsForRole } from '@common/rbac/rbac.util';

/**
 * Enforces @RequirePermissions() restrictions.
 * Runs after RolesGuard in the global guard chain.
 *
 * Behaviour:
 *   - No @RequirePermissions() → pass through
 *   - @Public() route          → pass through
 *   - SUPER_ADMIN              → always passes
 *   - Otherwise                → user's role must grant ALL listed permissions (AND logic)
 *
 * Guard order in CommonModule:
 *   JwtAuthGuard → RolesGuard → PermissionsGuard
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest<{ user: JwtPayload }>().user;

    // SUPER_ADMIN bypasses every permission gate
    if (user?.role === Role.SUPER_ADMIN) return true;

    if (!user?.role) {
      throw new ForbiddenException('No role found on authenticated user');
    }

    const hasAll = canPerformAll(user.role, requiredPermissions);

    if (!hasAll) {
      // Report which permissions are missing for easier debugging
      const userPermissions = getPermissionsForRole(user.role);
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.includes(p),
      );

      throw new ForbiddenException(
        `Access denied. Missing permission(s): ${missing.join(', ')}.`,
      );
    }

    return true;
  }
}
