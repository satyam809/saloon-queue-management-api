import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelEntryDto {
  @ApiPropertyOptional({ example: 'Customer left without being served' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
