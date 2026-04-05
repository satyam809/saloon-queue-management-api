import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueStatus } from '@common/enums/status.enum';
import { QueueEntry } from '../entities/queue-entry.entity';

/**
 * Response Data Transfer Object representing a single queue entry.
 *
 * Exposes all relevant fields of a {@link QueueEntry} entity in a
 * serialisation-safe shape, including a human-readable token display string.
 */
export class QueueEntryResponseDto {
  /** Unique identifier of the queue entry (UUID). */
  @ApiProperty() id: string;

  /** UUID of the parent queue this entry belongs to. */
  @ApiProperty() queueId: string;

  /** UUID of the customer who joined the queue. */
  @ApiProperty() customerId: string;

  /**
   * UUID of the assigned barber, or `null` if none has been assigned yet.
   */
  @ApiPropertyOptional() barberId: string | null;

  /**
   * UUID of the requested service, or `null` if the customer did not specify one.
   */
  @ApiPropertyOptional() serviceId: string | null;

  /** Sequential numeric token issued to the customer upon joining. */
  @ApiProperty() tokenNumber: number;

  /**
   * Human-readable token display string derived from `tokenNumber`.
   *
   * @example 'A-007'
   */
  @ApiProperty() tokenDisplay: string;          // e.g. "A-007"

  /** Ordinal position in the queue at the moment the customer checked in (1-based). */
  @ApiProperty() position: number;              // position at check-in

  /** Current lifecycle status of the queue entry. */
  @ApiProperty({ enum: QueueStatus }) status: QueueStatus;

  /**
   * Best-effort estimated wait time in minutes, or `null` when unavailable.
   */
  @ApiPropertyOptional() estimatedWaitMinutes: number | null;

  /** Optional free-text notes attached to the entry by the customer or staff. */
  @ApiPropertyOptional() notes: string | null;

  /** Timestamp at which the customer checked into the queue. */
  @ApiProperty() checkedInAt: Date;

  /** Timestamp at which the customer was called to the chair, or `null`. */
  @ApiPropertyOptional() calledAt: Date | null;

  /** Timestamp at which the service started, or `null` if not yet begun. */
  @ApiPropertyOptional() serviceStartedAt: Date | null;

  /** Timestamp at which the service was completed, or `null` if incomplete. */
  @ApiPropertyOptional() completedAt: Date | null;

  /** Timestamp at which the entry was cancelled, or `null` if not cancelled. */
  @ApiPropertyOptional() cancelledAt: Date | null;

  /** Human-readable reason the entry was cancelled, or `null` if not cancelled. */
  @ApiPropertyOptional() cancellationReason: string | null;

  /**
   * Maps a {@link QueueEntry} entity to a {@link QueueEntryResponseDto}.
   *
   * Generates the formatted `tokenDisplay` (e.g. `'A-007'`) from the numeric
   * `tokenNumber` and copies all other fields verbatim.
   *
   * @param entry - The source {@link QueueEntry} entity to map.
   * @returns A fully populated {@link QueueEntryResponseDto}.
   */
  static from(entry: QueueEntry): QueueEntryResponseDto {
    const dto                  = new QueueEntryResponseDto();
    dto.id                     = entry.id;
    dto.queueId                = entry.queueId;
    dto.customerId             = entry.customerId;
    dto.barberId               = entry.barberId;
    dto.serviceId              = entry.serviceId;
    dto.tokenNumber            = entry.tokenNumber;
    dto.tokenDisplay           = `A-${String(entry.tokenNumber).padStart(3, '0')}`;
    dto.position               = entry.position;
    dto.status                 = entry.status;
    dto.estimatedWaitMinutes   = entry.estimatedWaitMinutes;
    dto.notes                  = entry.notes;
    dto.checkedInAt            = entry.checkedInAt;
    dto.calledAt               = entry.calledAt;
    dto.serviceStartedAt       = entry.serviceStartedAt;
    dto.completedAt            = entry.completedAt;
    dto.cancelledAt            = entry.cancelledAt;
    dto.cancellationReason     = entry.cancellationReason;
    return dto;
  }
}
