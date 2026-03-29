import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinQueueDto {
  @ApiPropertyOptional({ example: 'Haircut + beard trim' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
