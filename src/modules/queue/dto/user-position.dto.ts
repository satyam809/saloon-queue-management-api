import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueStatus } from '@common/enums/status.enum';

/**
 * Response Data Transfer Object describing a customer's live position in a queue.
 *
 * Returned by the "my position" endpoint and refreshed on every poll so the
 * client can display real-time wait information without exposing other entries.
 */
export class UserPositionDto {
  /** UUID of the queue entry that belongs to the authenticated customer. */
  @ApiProperty() entryId: string;

  /** Sequential numeric token issued to the customer upon joining. */
  @ApiProperty() tokenNumber: number;

  /**
   * Human-readable token display string.
   *
   * @example 'A-007'
   */
  @ApiProperty() tokenDisplay: string;

  /** Current lifecycle status of the customer's queue entry. */
  @ApiProperty({ enum: QueueStatus }) status: QueueStatus;

  /**
   * The customer's current 1-based ordinal position in the waiting line.
   * `null` when the customer is no longer in a waiting state (e.g. being served,
   * completed, or cancelled).
   */
  @ApiProperty({ description: 'Live position in the waiting line (1-based). null when not waiting.' })
  livePosition: number | null;

  /**
   * Number of customers currently ahead of this entry in the queue.
   * `null` when the customer is not in a waiting state.
   */
  @ApiProperty({ description: 'Current number of people ahead' })
  peopleAhead: number | null;

  /**
   * Dynamically calculated estimated wait time in minutes based on live position.
   * `null` when the customer is not in a waiting state or estimation is unavailable.
   */
  @ApiProperty({ description: 'Estimated wait in minutes based on live position' })
  estimatedWaitMinutes: number | null;
}
