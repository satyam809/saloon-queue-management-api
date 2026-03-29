import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';
import { ROLE_PERMISSIONS } from './role-permissions.map';

/**
 * Programmatic permission check — use this in service-layer code when you need
 * to branch logic based on what the caller is allowed to do.
 *
 * @example
 * // Service layer ownership check
 * if (!canPerform(requester.role, Permission.SALON_UPDATE_ANY)) {
 *   if (salon.ownerId !== requester.sub) {
 *     throw new ForbiddenException('You can only update your own salon');
 *   }
 * }
 */
export function canPerform(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Returns all permissions granted to a role.
 */
export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Returns true if the role has ALL of the given permissions.
 */
export function canPerformAll(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => canPerform(role, p));
}

/**
 * Returns true if the role has AT LEAST ONE of the given permissions.
 */
export function canPerformAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => canPerform(role, p));
}
