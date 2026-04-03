import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyReviewDto {
  @ApiProperty({ description: 'Owner reply text (max 2 000 chars)', maxLength: 2000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  replyBody: string;
}
