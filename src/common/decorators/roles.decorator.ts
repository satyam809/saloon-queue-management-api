import { SetMetadata } from '@nestjs/common';
import { Role } from '@common/enums/role.enum';

/**
 * Metadata key used by `RolesGuard` to look up required roles on a route
 * handler or controller class.
 */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users whose role is one of the specified values.
 * SUPER_ADMIN always passes, regardless of which roles are listed.
 *
 * Use @Roles() when the restriction is identity-based ("only salon owners").
 * Use @RequirePermissions() when the restriction is capability-based ("anyone
 * who can manage queues"), which is more scalable as new roles are added.
 *
 * @param roles - One or more `Role` values permitted to access the route.
 *
 * @example
 * @Roles(Role.SALON_OWNER, Role.SUPER_ADMIN)
 * @Post('salons')
 * createSalon() {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
