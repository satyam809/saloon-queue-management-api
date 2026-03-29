import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveSalonDto {
  @ApiPropertyOptional({
    example: 'All documentation verified — welcome aboard!',
    description: 'Optional note recorded alongside the approval.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
