import { SetMetadata } from '@nestjs/common';
import { Permission } from '@common/enums/permission.enum';

/**
 * Metadata key used by `PermissionsGuard` to look up required permissions
 * on a route handler or controller class.
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to users whose role grants ALL of the listed permissions.
 * SUPER_ADMIN always passes.
 *
 * Prefer @RequirePermissions() over @Roles() for capability-based gates because:
 *   - Adding a new role only requires updating role-permissions.map.ts
 *   - Controllers remain decoupled from specific role names
 *   - The intent is self-documenting ("who can manage queues" vs "staff and owners")
 *
 * @param permissions - One or more `Permission` values that the caller must hold
 *                      (AND logic — all must be present).
 *
 * @example
 * @RequirePermissions(Permission.QUEUE_MANAGE)
 * @Patch(':id/call-next')
 * callNext() {}
 *
 * // Require multiple permissions (AND logic — user must have ALL):
 * @RequirePermissions(Permission.STAFF_CREATE, Permission.STAFF_UPDATE)
 * @Post('staff')
 * createStaff() {}
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
