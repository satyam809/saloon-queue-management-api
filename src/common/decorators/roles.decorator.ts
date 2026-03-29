import { SetMetadata } from '@nestjs/common';
import { Role } from '@common/enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users whose role is one of the specified values.
 * SUPER_ADMIN always passes, regardless of which roles are listed.
 *
 * Use @Roles() when the restriction is identity-based ("only salon owners").
 * Use @RequirePermissions() when the restriction is capability-based ("anyone
 * who can manage queues"), which is more scalable as new roles are added.
 *
 * @example
 * @Roles(Role.SALON_OWNER, Role.SUPER_ADMIN)
 * @Post('salons')
 * createSalon() {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
