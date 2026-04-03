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

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  // ─── Admin: full filtered list ────────────────────────────────────────────

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
