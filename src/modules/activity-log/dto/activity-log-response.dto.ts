import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '@common/enums/role.enum';
import { ActivityLog } from '../entities/activity-log.entity';

/**
 * Data Transfer Object returned by the API for all activity-log responses.
 *
 * Provides a serialisation-safe, flattened representation of an
 * {@link ActivityLog} entity, including before/after value snapshots and
 * request-context metadata.
 */
export class ActivityLogResponseDto {
  /** Unique identifier (UUID v4) of the log entry. */
  @ApiProperty() id: string;

  /**
   * UUID of the user who performed the action.
   * `null` for system-generated or anonymous actions.
   */
  @ApiPropertyOptional() userId: string | null;

  /**
   * Role of the actor at the time the action was recorded.
   * `null` when no authenticated role context was available.
   */
  @ApiPropertyOptional() actorRole: Role | null;

  /**
   * Machine-readable action identifier that describes what happened
   * (e.g. `queue.entry.cancelled`, `appointment.status.updated`).
   */
  @ApiProperty() action: string;

  /**
   * High-level category grouping related actions together
   * (e.g. `queue`, `appointment`, `payment`).
   */
  @ApiProperty() category: string;

  /**
   * Name of the entity type the action was performed on
   * (e.g. `queue_entry`, `appointment`, `review`).
   */
  @ApiProperty() entityType: string;

  /** UUID of the specific entity record the action was performed on. */
  @ApiProperty() entityId: string;

  /**
   * Snapshot of the entity's relevant field values **before** the action.
   * `null` when the action created a new record (no prior state).
   */
  @ApiPropertyOptional() oldValues: Record<string, any> | null;

  /**
   * Snapshot of the entity's relevant field values **after** the action.
   * `null` when the action deleted the record.
   */
  @ApiPropertyOptional() newValues: Record<string, any> | null;

  /**
   * Arbitrary key-value bag of supplementary context recorded alongside
   * the action (e.g. reason codes, related entity references).
   * `null` when no extra metadata was supplied.
   */
  @ApiPropertyOptional() metadata: Record<string, any> | null;

  /**
   * IP address of the client that triggered the action.
   * `null` when the action originated from an internal/system process.
   */
  @ApiPropertyOptional() ipAddress: string | null;

  /**
   * `User-Agent` header value from the HTTP request that triggered the action.
   * `null` when the action originated from an internal/system process.
   */
  @ApiPropertyOptional() userAgent: string | null;

  /** Timestamp when the activity log entry was recorded. */
  @ApiProperty() createdAt: Date;

  /**
   * Factory method that maps an {@link ActivityLog} entity to an
   * {@link ActivityLogResponseDto}.
   *
   * @param log - The raw ActivityLog entity retrieved from the database.
   * @returns A populated {@link ActivityLogResponseDto} ready for serialisation.
   */
  static from(log: ActivityLog): ActivityLogResponseDto {
    const dto        = new ActivityLogResponseDto();
    dto.id           = log.id;
    dto.userId       = log.userId;
    dto.actorRole    = log.actorRole;
    dto.action       = log.action;
    dto.category     = log.category;
    dto.entityType   = log.entityType;
    dto.entityId     = log.entityId;
    dto.oldValues    = log.oldValues;
    dto.newValues    = log.newValues;
    dto.metadata     = log.metadata;
    dto.ipAddress    = log.ipAddress;
    dto.userAgent    = log.userAgent;
    dto.createdAt    = log.createdAt;
    return dto;
  }
}
