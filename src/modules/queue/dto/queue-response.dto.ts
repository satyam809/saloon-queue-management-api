import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Queue } from '../entities/queue.entity';

/**
 * Response Data Transfer Object representing a daily salon queue.
 *
 * Exposes the public-facing fields of a {@link Queue} entity, including
 * operational state (open/closed) and aggregate serving statistics.
 */
export class QueueResponseDto {
  /** Unique identifier of the queue (UUID). */
  @ApiProperty() id: string;

  /** UUID of the salon that owns this queue. */
  @ApiProperty() salonId: string;

  /**
   * Calendar date this queue covers, in ISO 8601 date format (YYYY-MM-DD).
   *
   * @example '2026-03-29'
   */
  @ApiProperty() date: string;

  /** Indicates whether the queue is currently accepting new entries. */
  @ApiProperty() isOpen: boolean;

  /** Timestamp at which the queue was opened, or `null` if not yet opened. */
  @ApiPropertyOptional() openedAt: Date | null;

  /** Timestamp at which the queue was closed, or `null` if still open. */
  @ApiPropertyOptional() closedAt: Date | null;

  /**
   * The position number currently being served.
   * All entries with a position lower than or equal to this value have been called.
   */
  @ApiProperty() currentServingPosition: number;

  /** Total number of customers that have been fully served today. */
  @ApiProperty() totalServed: number;

  /** Timestamp at which the queue record was first created. */
  @ApiProperty() createdAt: Date;

  /**
   * Maps a {@link Queue} entity to a {@link QueueResponseDto}.
   *
   * Copies all relevant fields from the entity verbatim.
   *
   * @param queue - The source {@link Queue} entity to map.
   * @returns A fully populated {@link QueueResponseDto}.
   */
  static from(queue: Queue): QueueResponseDto {
    const dto                     = new QueueResponseDto();
    dto.id                        = queue.id;
    dto.salonId                   = queue.salonId;
    dto.date                      = queue.date;
    dto.isOpen                    = queue.isOpen;
    dto.openedAt                  = queue.openedAt;
    dto.closedAt                  = queue.closedAt;
    dto.currentServingPosition    = queue.currentServingPosition;
    dto.totalServed               = queue.totalServed;
    dto.createdAt                 = queue.createdAt;
    return dto;
  }
}
