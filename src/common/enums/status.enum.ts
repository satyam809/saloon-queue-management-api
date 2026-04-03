// ─── User ────────────────────────────────────────────────────────────────────

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

// ─── Salon ───────────────────────────────────────────────────────────────────

export enum SalonStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  INACTIVE  = 'inactive',
  SUSPENDED = 'suspended',
  REJECTED  = 'rejected',
  ARCHIVED  = 'archived',
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export enum StaffRole {
  MANAGER = 'manager',
  RECEPTIONIST = 'receptionist',
  STAFF = 'staff',
}

export enum StaffStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
}

// ─── Barber ──────────────────────────────────────────────────────────────────

export enum BarberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export enum QueueStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export enum PaymentMethod {
  CASH   = 'cash',
  CARD   = 'card',      // POS terminal (offline) or online card
  ONLINE = 'online',    // payment gateway (Stripe, PayPal, etc.)
  WALLET = 'wallet',    // in-app wallet
}

/** Which gateway processed (or will process) this payment. */
export enum PaymentProvider {
  MANUAL  = 'manual',   // offline — cash or POS terminal
  STRIPE  = 'stripe',
  PAYPAL  = 'paypal',
  SQUARE  = 'square',
}

export enum PaymentStatus {
  PENDING             = 'pending',
  COMPLETED           = 'completed',
  FAILED              = 'failed',
  REFUNDED            = 'refunded',
  PARTIALLY_REFUNDED  = 'partially_refunded',
  CANCELLED           = 'cancelled',
}
