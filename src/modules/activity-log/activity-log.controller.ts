import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { ActivityLogResponseDto } from './dto/activity-log-response.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * REST controller that exposes audit / activity-log endpoints.
 *
 * Base route: `/activity-logs`
 *
 * All routes require a valid JWT bearer token. Access to specific endpoints
 * is gated by the permissions declared via `@RequirePermissions`.
 */
@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogController {
  /**
   * @param activityLogService - Service that handles all activity-log queries.
   */
  constructor(private readonly activityLogService: ActivityLogService) {}

  // ─── Admin: full filtered list ────────────────────────────────────────────

  /**
   * GET /activity-logs
   *
   * Returns a paginated, filterable list of all activity log entries in the
   * system. Intended for administrators who hold the
   * `ACTIVITY_LOG_READ_ALL` permission.
   *
   * Supported query parameters:
   * - `userId`     — filter by actor user UUID
   * - `actorRole`  — filter by actor role string (e.g. `salon_owner`)
   * - `action`     — filter by action string (e.g. `queue.entry.cancelled`)
   * - `category`   — filter by category (e.g. `queue`)
   * - `entityType` — filter by entity type (e.g. `queue_entry`)
   * - `entityId`   — filter by entity UUID
   * - `fromDate`   — ISO 8601 range start (inclusive)
   * - `toDate`     — ISO 8601 range end (inclusive)
   * - `page` / `limit` — pagination controls
   *
   * @param query - Parsed and validated query parameters.
   * @returns Paginated list of {@link ActivityLogResponseDto}.
   */
  @Get()
  @RequirePermissions(Permission.ACTIVITY_LOG_READ_ALL)
  @ApiOperation({
    summary: 'List all activity logs (admin)',
    description:
      'Paginated, filterable audit log for admins. ' +
      'Supports ?userId=, ?actorRole=, ?action=, ?category=, ?entityType=, ?entityId=, ?fromDate=, ?toDate=, ?page=, ?limit=',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of ActivityLogResponseDto' })
  findAll(@Query() query: ActivityLogQueryDto) {
    return this.activityLogService.findAll(query);
  }

  // ─── Own logs ─────────────────────────────────────────────────────────────

  /**
   * GET /activity-logs/me
   *
   * Returns a paginated list of activity logs that were created by the
   * currently authenticated user. The `userId` scope is applied automatically
   * from the JWT payload — callers cannot query other users' logs via this
   * endpoint.
   *
   * Supports the same filters as `GET /activity-logs` except `?userId=`.
   *
   * @param query     - Parsed and validated query parameters (excluding userId).
   * @param requester - Decoded JWT payload of the authenticated user.
   * @returns Paginated list of {@link ActivityLogResponseDto} for the caller.
   */
  @Get('me')
  @RequirePermissions(Permission.ACTIVITY_LOG_READ_OWN)
  @ApiOperation({
    summary: 'List my activity logs',
    description:
      'Returns only logs created by the authenticated user. ' +
      'Supports same filters as /activity-logs except ?userId= (scoped automatically).',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of ActivityLogResponseDto' })
  findMine(
    @Query() query: ActivityLogQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.activityLogService.findAll(query, requester.sub);
  }

  // ─── Audit trail for a specific entity ───────────────────────────────────

  /**
   * GET /activity-logs/entity/:entityType/:entityId
   *
   * Returns the full, ordered audit trail for a single named entity record
   * (e.g. all status transitions ever recorded for a specific `queue_entry`).
   * Results are ordered by `createdAt DESC` (newest first).
   *
   * Requires the `ACTIVITY_LOG_READ_ALL` permission.
   *
   * @param entityType - The entity type name (e.g. `queue_entry`, `appointment`).
   * @param entityId   - UUID of the specific entity record.
   * @param query      - Pagination parameters (`page`, `limit`).
   * @returns Paginated list of {@link ActivityLogResponseDto} for the entity.
   */
  @Get('entity/:entityType/:entityId')
  @RequirePermissions(Permission.ACTIVITY_LOG_READ_ALL)
  @ApiOperation({
    summary: 'Get full audit trail for one entity record',
    description:
      'Returns every log entry for a specific entity (e.g. all status transitions of a queue_entry). ' +
      'Ordered by createdAt DESC.',
  })
  @ApiParam({ name: 'entityType', description: 'Entity type', example: 'queue_entry' })
  @ApiParam({ name: 'entityId',   description: 'Entity UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of ActivityLogResponseDto' })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query() query: PaginationDto,
  ) {
    return this.activityLogService.findByEntity(entityType, entityId, query);
  }
}
