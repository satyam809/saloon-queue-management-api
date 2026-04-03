import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class ActivityLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by actor role', example: 'salon_owner' })
  @IsOptional()
  @IsString()
  actorRole?: string;

  @ApiPropertyOptional({ description: 'Filter by action', example: 'queue.entry.cancelled' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'queue' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type', example: 'queue_entry' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 start date', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 end date', example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
