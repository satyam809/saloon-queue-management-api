import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * FlagReviewDto — payload for the admin review moderation endpoint.
 *
 * Used by SUPER_ADMIN to toggle the public visibility of a review.
 * An optional `reason` field can be stored for audit purposes.
 */
export class FlagReviewDto {
  /**
   * New published state for the review.
   * `false` hides the review from public listings; `true` restores it.
   */
  @ApiProperty({
    description: 'Set to false to hide the review, true to restore it',
  })
  @IsBoolean()
  isPublished: boolean;

  /**
   * Optional admin note explaining the moderation decision.
   * Stored for audit trail context. Maximum 500 characters.
   */
  @ApiPropertyOptional({ description: 'Admin note explaining the moderation decision', maxLength: 500 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
