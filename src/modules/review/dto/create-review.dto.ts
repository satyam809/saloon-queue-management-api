import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateReviewDto — payload for submitting a new review.
 *
 * At minimum, `salonId` and `rating` are required.
 * Providing `queueEntryId` or `appointmentId` proves the customer visited
 * and sets `isVerifiedVisit = true` on the resulting Review entity.
 */
export class CreateReviewDto {
  /** UUID of the salon being reviewed. */
  @ApiProperty({ description: 'UUID of the salon being reviewed' })
  @IsUUID()
  salonId: string;

  /**
   * Overall rating from 1 (worst) to 5 (best).
   * Validated by both class-validator and a DB CHECK constraint.
   */
  @ApiProperty({ description: 'Rating from 1 (worst) to 5 (best)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  /**
   * Optional short headline for the review (max 150 characters).
   * Must be non-empty when provided.
   */
  @ApiPropertyOptional({ example: 'Great haircut!', maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  /**
   * Optional written review body.
   * Must be non-empty when provided.
   */
  @ApiPropertyOptional({ example: 'The barber was very professional and precise.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  /**
   * Optional UUID of the barber to rate within this review.
   * Enables barber-level analytics in addition to the salon-level rating.
   */
  @ApiPropertyOptional({ description: 'Optional barber-level rating — UUID of the barber' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  /**
   * UUID of the queue entry that proves the customer visited.
   * Providing this value sets `isVerifiedVisit = true`.
   * Only one review per queue entry is allowed.
   */
  @ApiPropertyOptional({ description: 'Queue entry UUID — proves the customer visited (verified review)' })
  @IsOptional()
  @IsUUID()
  queueEntryId?: string;

  /**
   * UUID of the appointment that proves the customer visited.
   * Providing this value sets `isVerifiedVisit = true`.
   * Only one review per appointment is allowed.
   */
  @ApiPropertyOptional({ description: 'Appointment UUID — proves the customer visited (verified review)' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}
