import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FlagReviewDto {
  @ApiProperty({
    description: 'Set to false to hide the review, true to restore it',
  })
  @IsBoolean()
  isPublished: boolean;

  @ApiPropertyOptional({ description: 'Admin note explaining the moderation decision', maxLength: 500 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
