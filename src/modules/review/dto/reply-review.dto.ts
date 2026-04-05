import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * ReplyReviewDto — payload for the salon owner reply endpoint.
 *
 * Contains the plain-text reply body that the salon owner or admin
 * wishes to post as a public response to a customer review.
 */
export class ReplyReviewDto {
  /**
   * The reply text written by the salon owner or admin.
   * Must be a non-empty string with a maximum of 2 000 characters.
   */
  @ApiProperty({ description: 'Owner reply text (max 2 000 chars)', maxLength: 2000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  replyBody: string;
}
