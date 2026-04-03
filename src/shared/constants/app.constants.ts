export const CACHE_TTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  DAY: 86400,       // 24 hours
} as const;

// ─── Queue ────────────────────────────────────────────────────────────────────

export const QUEUE_CACHE_KEY = {
  /**
   * Sorted Set — score = join timestamp (ms), member = entryId.
   * Represents the live waiting line for a queue session.
   * ZADD on join, ZREM on callNext/cancel, ZRANK for live position.
   */
  WAITING_SET: (queueId: string) => `queue:${queueId}:waiting`,

  /**
   * String counter — atomically incremented via INCR to assign token numbers.
   * Avoids DB round-trips and race conditions for concurrent joins.
   */
  TOKEN_SEQ: (queueId: string) => `queue:${queueId}:token_seq`,

  /**
   * Hash — cached queue state for read-heavy public endpoints.
   * Fields: isOpen, waitingCount, currentToken, avgDurationSeconds, totalDurationSum, completedCount
   */
  STATE: (queueId: string) => `queue:${queueId}:state`,

  /**
   * JSON string — per-user position snapshot cached for 5 min.
   * Refreshed on every join / state transition.
   */
  USER_POSITION: (queueId: string, userId: string) =>
    `queue:${queueId}:user:${userId}`,

  /**
   * String lock — set via Lua to atomically prevent a customer from joining
   * the same queue twice. SET NX EX inside CLAIM_TOKEN script.
   * Deleted on cancel / terminal status transition.
   */
  MEMBER_LOCK: (queueId: string, customerId: string) =>
    `queue:${queueId}:member:${customerId}`,
} as const;

export const QUEUE_TTL = {
  /** Token counter and waiting sorted set expire at end of day (8 hours headroom). */
  EOD_SECONDS: 86400,
  /** Queue state hash — short TTL, re-built from DB on miss. */
  STATE_SECONDS: 60,
  /** Per-user position snapshot — refreshed on activity. */
  USER_POSITION_SECONDS: 300,
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

// ─── Notification ─────────────────────────────────────────────────────────────

export const NOTIFICATION_CACHE_KEY = {
  /**
   * JSON string — full list of a user's notification preferences.
   * Cached to avoid a DB hit on every dispatch channel-check.
   * Invalidated when the user updates any preference.
   */
  USER_PREFERENCES: (userId: string) => `notification:prefs:${userId}`,
} as const;

export const NOTIFICATION_TTL = {
  /** Preference cache — short TTL so opt-out propagates quickly. */
  PREFERENCES_SECONDS: 300, // 5 minutes
} as const;

// ─── Analytics ────────────────────────────────────────────────────────────────

export const ANALYTICS_CACHE_KEY = {
  /**
   * JSON blob — full revenue/customer/performance report for a given
   * salon + date range + granularity combination.
   * Key format: analytics:{type}:{salonId|all}:{start}:{end}:{granularity}
   */
  REPORT: (
    type: 'revenue' | 'customers' | 'performance',
    salonId: string,
    start: string,
    end: string,
    granularity: string,
  ) => `analytics:${type}:${salonId}:${start}:${end}:${granularity}`,
} as const;

export const ANALYTICS_TTL = {
  /** Report cache — 15 minutes balances freshness with query cost. */
  REPORT_SECONDS: 900,
} as const;
