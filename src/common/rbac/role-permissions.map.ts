import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';

/**
 * The single source of truth for what each role is allowed to do.
 *
 * Rules:
 *   - SUPER_ADMIN receives every permission automatically (see canPerform()).
 *   - Adding a new permission: define it in permission.enum.ts, then add it to
 *     the relevant role(s) here. No guard or controller changes needed.
 *   - Adding a new role: add it to role.enum.ts and define its permission set here.
 *
 * Ownership vs permission:
 *   Permissions like SALON_UPDATE_OWN grant the capability to update a salon;
 *   the ownership check (is this the user's salon?) is still enforced in the
 *   service layer. The guard only checks capability, not resource identity.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {

  // ─── Super Admin ─────────────────────────────────────────────────────────
  // Assigned dynamically in canPerform() — explicitly listing every permission
  // here would require maintenance every time a new one is added.
  [Role.SUPER_ADMIN]: Object.values(Permission) as Permission[],

  // ─── Onboarding Staff ────────────────────────────────────────────────────
  // Internal team members who verify new salon registrations.
  [Role.ONBOARDING_STAFF]: [
    Permission.USER_READ_ALL,
    Permission.USER_READ_OWN,
    Permission.USER_UPDATE_OWN,
    Permission.SALON_READ_ALL,
    Permission.SALON_VERIFY,
    Permission.ANALYTICS_READ_ALL,
    Permission.ACTIVITY_LOG_READ_ALL,
    Permission.NOTIFICATION_READ_OWN,
  ],

  // ─── Salon Owner ─────────────────────────────────────────────────────────
  // Business owners who registered their salon on the platform.
  [Role.SALON_OWNER]: [
    // Own profile
    Permission.USER_READ_OWN,
    Permission.USER_UPDATE_OWN,
    // Salon management
    Permission.SALON_CREATE,
    Permission.SALON_READ_ALL,
    Permission.SALON_UPDATE_OWN,
    Permission.SALON_DELETE_OWN,
    // Staff management
    Permission.STAFF_READ,
    Permission.STAFF_CREATE,
    Permission.STAFF_UPDATE,
    Permission.STAFF_DELETE,
    // Barber management
    Permission.BARBER_READ,
    Permission.BARBER_CREATE,
    Permission.BARBER_UPDATE,
    Permission.BARBER_DELETE,
    // Service catalog
    Permission.SERVICE_READ,
    Permission.SERVICE_CREATE,
    Permission.SERVICE_UPDATE,
    Permission.SERVICE_DELETE,
    // Queue operations
    Permission.QUEUE_CREATE,
    Permission.QUEUE_READ,
    Permission.QUEUE_MANAGE,
    Permission.QUEUE_CLOSE,
    // Appointments
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_READ_SALON,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL_ANY,
    // Payments
    Permission.PAYMENT_READ_SALON,
    Permission.PAYMENT_REFUND,
    // Reviews
    Permission.REVIEW_READ,
    Permission.REVIEW_REPLY,
    // Analytics
    Permission.ANALYTICS_READ_SALON,
    // Notifications
    Permission.NOTIFICATION_READ_OWN,
    // Logs
    Permission.ACTIVITY_LOG_READ_OWN,
  ],

  // ─── Staff ───────────────────────────────────────────────────────────────
  // Front-desk / floor employees within a salon.
  [Role.STAFF]: [
    // Own profile
    Permission.USER_READ_OWN,
    Permission.USER_UPDATE_OWN,
    // Read-only salon info
    Permission.SALON_READ_ALL,
    // Barber availability
    Permission.BARBER_READ,
    Permission.BARBER_UPDATE,    // can toggle is_available
    // Service catalog (read-only)
    Permission.SERVICE_READ,
    // Queue operations
    Permission.QUEUE_CREATE,
    Permission.QUEUE_READ,
    Permission.QUEUE_MANAGE,
    Permission.QUEUE_CLOSE,
    // Appointments
    Permission.APPOINTMENT_READ_SALON,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL_ANY,
    // Payments (read-only + cash collection)
    Permission.PAYMENT_READ_SALON,
    // Reviews (read-only)
    Permission.REVIEW_READ,
    // Notifications
    Permission.NOTIFICATION_READ_OWN,
  ],

  // ─── Customer ────────────────────────────────────────────────────────────
  // End users of the platform.
  [Role.CUSTOMER]: [
    // Own profile
    Permission.USER_READ_OWN,
    Permission.USER_UPDATE_OWN,
    // Browse
    Permission.SALON_READ_ALL,
    Permission.BARBER_READ,
    Permission.SERVICE_READ,
    // Queue
    Permission.QUEUE_READ,
    Permission.QUEUE_JOIN,
    // Appointments
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_READ_OWN,
    Permission.APPOINTMENT_CANCEL_OWN,
    // Payments
    Permission.PAYMENT_READ_OWN,
    // Reviews
    Permission.REVIEW_CREATE,
    Permission.REVIEW_READ,
    // Notifications
    Permission.NOTIFICATION_READ_OWN,
    // Own activity log
    Permission.ACTIVITY_LOG_READ_OWN,
  ],
};
