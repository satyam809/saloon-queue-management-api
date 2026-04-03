import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Review } from '../entities/review.entity';

export class ReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() salonId: string;
  @ApiProperty() customerId: string;
  @ApiPropertyOptional() barberId: string | null;
  @ApiPropertyOptional() queueEntryId: string | null;
  @ApiPropertyOptional() appointmentId: string | null;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating: number;
  @ApiPropertyOptional() title: string | null;
  @ApiPropertyOptional() body: string | null;
  @ApiProperty() isVerifiedVisit: boolean;
  @ApiProperty() isPublished: boolean;
  @ApiPropertyOptional() publishedAt: Date | null;

  // ─── Owner reply ─────────────────────────────────────────────────────────
  @ApiPropertyOptional() replyBody: string | null;
  @ApiPropertyOptional() repliedBy: string | null;
  @ApiPropertyOptional() repliedAt: Date | null;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

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
