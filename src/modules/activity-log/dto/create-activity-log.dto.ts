import type { Role } from '@common/enums/role.enum';

/**
 * Internal DTO — used only within services, never exposed over HTTP.
 * No class-validator decorators intentionally.
 */
export class CreateActivityLogDto {
  userId:     string | null;
  actorRole:  Role | null;

  /** Dot-notation: 'queue.entry.cancelled', 'payment.refunded' */
  action:     string;

  /** Top-level group: 'queue', 'payment', 'barber', 'service', 'review', 'user', 'salon', 'appointment' */
  category:   string;

  /** Entity type: 'queue_entry', 'payment', 'barber', etc. */
  entityType: string;

  /** UUID of the affected record */
  entityId:   string;

  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;

  /** Arbitrary context beyond state diffs (reason, tokenNumber, etc.) */
  metadata?:  Record<string, any> | null;

  ipAddress?: string | null;
  userAgent?: string | null;
}
