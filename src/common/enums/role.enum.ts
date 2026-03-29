/**
 * Application-level user roles stored in the JWT and the users.role column.
 *
 * Hierarchy (highest → lowest privilege):
 *   SUPER_ADMIN > ONBOARDING_STAFF | SALON_OWNER > STAFF > CUSTOMER
 *
 * Note: ONBOARDING_STAFF and SALON_OWNER are parallel — neither is above the other.
 * Their capabilities are defined in the role-permissions map, not a linear hierarchy.
 */
export enum Role {
  SUPER_ADMIN      = 'super_admin',
  ONBOARDING_STAFF = 'onboarding_staff',
  SALON_OWNER      = 'salon_owner',
  STAFF            = 'staff',
  CUSTOMER         = 'customer',
}
