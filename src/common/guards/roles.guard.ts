import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * Enforces @Roles() restrictions.
 * Runs after JwtAuthGuard (req.user is guaranteed to be populated).
 *
 * Behaviour:
 *   - No @Roles() on route → pass through (any authenticated user may access)
 *   - @Public() route     → pass through (JwtAuthGuard already skipped it)
 *   - SUPER_ADMIN user    → always passes (global bypass)
 *   - Otherwise           → user.role must be in the @Roles() list
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip public routes — already handled by JwtAuthGuard
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() annotation — route is accessible to any authenticated user
    if (!requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user: JwtPayload }>().user;

    // SUPER_ADMIN bypasses every role gate
    if (user?.role === Role.SUPER_ADMIN) return true;

    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}. ` +
        `Your role: ${user?.role ?? 'unknown'}.`,
      );
    }

    return true;
  }
}
