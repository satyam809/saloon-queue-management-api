import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Review } from '../entities/review.entity';

/**
 * Data Transfer Object returned by the API for all review-related responses.
 *
 * Provides a flattened, serialisation-safe representation of a {@link Review}
 * entity, including optional owner-reply fields.
 */
export class ReviewResponseDto {
  /** Unique identifier (UUID v4) of the review. */
  @ApiProperty() id: string;

  /** UUID of the salon that was reviewed. */
  @ApiProperty() salonId: string;

  /** UUID of the customer who submitted the review. */
  @ApiProperty() customerId: string;

  /**
   * UUID of the barber the review was specifically directed at.
   * `null` when the review targets the salon in general.
   */
  @ApiPropertyOptional() barberId: string | null;

  /**
   * UUID of the queue entry that triggered this review opportunity.
   * `null` when the review is not tied to a walk-in queue visit.
   */
  @ApiPropertyOptional() queueEntryId: string | null;

  /**
   * UUID of the appointment that triggered this review opportunity.
   * `null` when the review is not tied to a booked appointment.
   */
  @ApiPropertyOptional() appointmentId: string | null;

  /**
   * Numeric star rating given by the customer.
   * Must be between 1 (lowest) and 5 (highest).
   */
  @ApiProperty({ minimum: 1, maximum: 5 }) rating: number;

  /**
   * Optional short headline for the review (e.g. "Great haircut!").
   * `null` when the customer did not supply a title.
   */
  @ApiPropertyOptional() title: string | null;

  /**
   * Optional long-form review text written by the customer.
   * `null` when the customer did not supply a body.
   */
  @ApiPropertyOptional() body: string | null;

  /**
   * Indicates whether the reviewer has a verified visit record in the system
   * (i.e. an associated appointment or queue entry that was completed).
   */
  @ApiProperty() isVerifiedVisit: boolean;

  /** Whether the review is publicly visible on the salon's profile. */
  @ApiProperty() isPublished: boolean;

  /**
   * Timestamp when the review was made publicly visible.
   * `null` when the review has not been published yet.
   */
  @ApiPropertyOptional() publishedAt: Date | null;

  // ─── Owner reply ─────────────────────────────────────────────────────────

  /**
   * Text of the salon owner's reply to this review.
   * `null` when no reply has been submitted.
   */
  @ApiPropertyOptional() replyBody: string | null;

  /**
   * UUID of the staff member (owner or manager) who submitted the reply.
   * `null` when no reply has been submitted.
   */
  @ApiPropertyOptional() repliedBy: string | null;

  /**
   * Timestamp when the owner reply was saved.
   * `null` when no reply has been submitted.
   */
  @ApiPropertyOptional() repliedAt: Date | null;

  /** Timestamp when the review record was first created. */
  @ApiProperty() createdAt: Date;

  /** Timestamp of the most recent update to the review record. */
  @ApiProperty() updatedAt: Date;

  /**
   * Factory method that maps a {@link Review} entity to a {@link ReviewResponseDto}.
   *
   * @param review - The raw Review entity retrieved from the database.
   * @returns A populated {@link ReviewResponseDto} instance ready for serialisation.
   */
  static from(review: Review): ReviewResponseDto {
    const dto            = new ReviewResponseDto();
    dto.id               = review.id;
    dto.salonId          = review.salonId;
    dto.customerId       = review.customerId;
    dto.barberId         = review.barberId;
    dto.queueEntryId     = review.queueEntryId;
    dto.appointmentId    = review.appointmentId;
    dto.rating           = review.rating;
    dto.title            = review.title;
    dto.body             = review.body;
    dto.isVerifiedVisit  = review.isVerifiedVisit;
    dto.isPublished      = review.isPublished;
    dto.publishedAt      = review.publishedAt;
    dto.replyBody        = review.replyBody;
    dto.repliedBy        = review.repliedBy;
    dto.repliedAt        = review.repliedAt;
    dto.createdAt        = review.createdAt;
    dto.updatedAt        = review.updatedAt;
    return dto;
  }
}
