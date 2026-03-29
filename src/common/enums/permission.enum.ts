/**
 * Granular permission strings following the convention:
 *   <resource>:<action>:<scope?>
 *
 * Scope variants:
 *   :own  — only resources the user owns / belongs to
 *   :any  — any resource in the system (admin-level)
 *   (none) — action is not scope-dependent
 *
 * Using a `const` object (not enum) lets us derive the union type automatically
 * and iterate the values without TypeScript's enum runtime object overhead.
 */
export const Permission = {

  // ─── Users ───────────────────────────────────────────────────────────────
  USER_READ_ALL:    'user:read:all',
  USER_READ_OWN:    'user:read:own',
  USER_CREATE:      'user:create',
  USER_UPDATE_OWN:  'user:update:own',
  USER_UPDATE_ANY:  'user:update:any',
  USER_DELETE_ANY:  'user:delete:any',
  USER_SUSPEND:     'user:suspend',

  // ─── Salons ──────────────────────────────────────────────────────────────
  SALON_CREATE:     'salon:create',
  SALON_READ_ALL:   'salon:read:all',
  SALON_UPDATE_OWN: 'salon:update:own',
  SALON_UPDATE_ANY: 'salon:update:any',
  SALON_DELETE_OWN: 'salon:delete:own',
  SALON_DELETE_ANY: 'salon:delete:any',
  SALON_VERIFY:     'salon:verify',        // onboarding_staff approves a new salon

  // ─── Staff ───────────────────────────────────────────────────────────────
  STAFF_READ:       'staff:read',
  STAFF_CREATE:     'staff:create',
  STAFF_UPDATE:     'staff:update',
  STAFF_DELETE:     'staff:delete',

  // ─── Barbers ─────────────────────────────────────────────────────────────
  BARBER_READ:      'barber:read',
  BARBER_CREATE:    'barber:create',
  BARBER_UPDATE:    'barber:update',
  BARBER_DELETE:    'barber:delete',

  // ─── Services ────────────────────────────────────────────────────────────
  SERVICE_READ:     'service:read',
  SERVICE_CREATE:   'service:create',
  SERVICE_UPDATE:   'service:update',
  SERVICE_DELETE:   'service:delete',

  // ─── Queue ───────────────────────────────────────────────────────────────
  QUEUE_CREATE:     'queue:create',        // open a new day queue
  QUEUE_READ:       'queue:read',
  QUEUE_JOIN:       'queue:join',          // customer joins the queue
  QUEUE_MANAGE:     'queue:manage',        // call-next, complete, mark no-show
  QUEUE_CLOSE:      'queue:close',

  // ─── Appointments ────────────────────────────────────────────────────────
  APPOINTMENT_CREATE:        'appointment:create',
  APPOINTMENT_READ_OWN:      'appointment:read:own',
  APPOINTMENT_READ_SALON:    'appointment:read:salon',
  APPOINTMENT_READ_ALL:      'appointment:read:all',
  APPOINTMENT_UPDATE:        'appointment:update',
  APPOINTMENT_CANCEL_OWN:    'appointment:cancel:own',
  APPOINTMENT_CANCEL_ANY:    'appointment:cancel:any',

  // ─── Payments ────────────────────────────────────────────────────────────
  PAYMENT_READ_OWN:    'payment:read:own',
  PAYMENT_READ_SALON:  'payment:read:salon',
  PAYMENT_READ_ALL:    'payment:read:all',
  PAYMENT_REFUND:      'payment:refund',

  // ─── Reviews ─────────────────────────────────────────────────────────────
  REVIEW_CREATE:     'review:create',
  REVIEW_READ:       'review:read',
  REVIEW_REPLY:      'review:reply',       // salon owner replies to a review
  REVIEW_MODERATE:   'review:moderate',    // admin hides/removes a review

  // ─── Analytics ───────────────────────────────────────────────────────────
  ANALYTICS_READ_SALON: 'analytics:read:salon',
  ANALYTICS_READ_ALL:   'analytics:read:all',

  // ─── Notifications ───────────────────────────────────────────────────────
  NOTIFICATION_READ_OWN:  'notification:read:own',
  NOTIFICATION_SEND_ANY:  'notification:send:any',

  // ─── Activity logs ───────────────────────────────────────────────────────
  ACTIVITY_LOG_READ_OWN:  'activity_log:read:own',
  ACTIVITY_LOG_READ_ALL:  'activity_log:read:all',

} as const;

/** Union type of every permission string — use this for typing. */
export type Permission = (typeof Permission)[keyof typeof Permission];
