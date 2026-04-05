import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query parameters accepted by the activity-log list endpoints.
 *
 * Extends {@link PaginationDto} to inherit `page` and `limit` fields.
 * All fields are optional — omitting a field means "no filter applied"
 * for that dimension.
 */
export class ActivityLogQueryDto extends PaginationDto {
  /**
   * Restrict results to logs produced by a specific user.
   * Must be a valid UUID v4 matching a `users.id` record.
   */
  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Restrict results to logs produced by actors carrying a specific role
   * at the time the action was performed (e.g. `salon_owner`, `barber`).
   */
  @ApiPropertyOptional({ description: 'Filter by actor role', example: 'salon_owner' })
  @IsOptional()
  @IsString()
  actorRole?: string;

  /**
   * Restrict results to a specific action string
   * (e.g. `queue.entry.cancelled`, `appointment.created`).
   */
  @ApiPropertyOptional({ description: 'Filter by action', example: 'queue.entry.cancelled' })
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * Restrict results to a high-level event category
   * (e.g. `queue`, `appointment`, `payment`).
   */
  @ApiPropertyOptional({ description: 'Filter by category', example: 'queue' })
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * Restrict results to logs that reference a particular entity type
   * (e.g. `queue_entry`, `appointment`, `review`).
   */
  @ApiPropertyOptional({ description: 'Filter by entity type', example: 'queue_entry' })
  @IsOptional()
  @IsString()
  entityType?: string;

  /**
   * Restrict results to logs that reference a specific entity record.
   * Must be a valid UUID v4.
   */
  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  /**
   * Inclusive lower bound for the `createdAt` timestamp range.
   * Must be a valid ISO 8601 date-time string (e.g. `2026-01-01T00:00:00Z`).
   */
  @ApiPropertyOptional({ description: 'ISO 8601 start date', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /**
   * Inclusive upper bound for the `createdAt` timestamp range.
   * Must be a valid ISO 8601 date-time string (e.g. `2026-12-31T23:59:59Z`).
   */
  @ApiPropertyOptional({ description: 'ISO 8601 end date', example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
