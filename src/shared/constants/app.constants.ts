export const CACHE_TTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  DAY: 86400,       // 24 hours
} as const;

// ─── Queue ────────────────────────────────────────────────────────────────────

export const QUEUE_CACHE_KEY = {
  SALON_QUEUE: (salonId: string) => `queue:salon:${salonId}`,
  USER_POSITION: (queueId: string, userId: string) =>
    `queue:${queueId}:user:${userId}`,
} as const;

// ─── Auth tokens ──────────────────────────────────────────────────────────────

export const TOKEN_CACHE_KEY = {
  /** Stored refresh token — one entry per user (single-session). */
  REFRESH: (userId: string) => `auth:refresh:${userId}`,
  /** Short-lived password-reset token (10 min TTL). */
  RESET_PASSWORD: (token: string) => `auth:reset:${token}`,
} as const;

// ─── User status cache ────────────────────────────────────────────────────────

export const USER_CACHE_KEY = {
  /**
   * Caches active/suspended status for 60 s.
   * Checked on every authenticated request so we avoid a DB hit per request
   * while still blocking suspended accounts within one cache window.
   */
  STATUS: (userId: string) => `user:status:${userId}`,
} as const;

export const RESET_PASSWORD_TTL_SECONDS = 600; // 10 minutes
