import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { JoinQueueDto } from './dto/join-queue.dto';
import { CancelEntryDto } from './dto/cancel-entry.dto';
import { QueueResponseDto } from './dto/queue-response.dto';
import { QueueEntryResponseDto } from './dto/queue-entry-response.dto';
import { LiveQueueStateDto } from './dto/live-queue-state.dto';
import { UserPositionDto } from './dto/user-position.dto';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';
import { QueueStatus } from '@common/enums/status.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@ApiTags('Queue')
@ApiBearerAuth()
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // ─── Public: live status ──────────────────────────────────────────────────

  /**
   * GET /queues/salon/:salonId/live?date=YYYY-MM-DD
   * No auth required — intended for public displays, walk-in customers.
   * Returns cached queue state (Redis hit = no DB query).
   */
  @Public()
  @Get('salon/:salonId/live')
  @ApiOperation({
    summary: 'Live queue status for a salon (public)',
    description:
      'Returns waiting count, current serving token, and EWT for new customers. ' +
      'Served from Redis cache (60 s TTL) — no DB hit on cache hit.',
  })
  @ApiParam({ name: 'salonId', description: 'Salon UUID' })
  @ApiQuery({ name: 'date', example: '2026-03-30', required: true })
  @ApiResponse({ status: 200, type: LiveQueueStateDto })
  getLiveState(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query('date') date: string,
  ): Promise<LiveQueueStateDto> {
    return this.queueService.getLiveState(salonId, date);
  }

  // ─── Authenticated: queue lookup ──────────────────────────────────────────

  @Get('salon/:salonId')
  @RequirePermissions(Permission.QUEUE_READ)
  @ApiOperation({ summary: 'Get queue record for a salon on a specific date' })
  @ApiParam({ name: 'salonId', description: 'Salon UUID' })
  @ApiQuery({ name: 'date', example: '2026-03-30', required: true })
  @ApiResponse({ status: 200, type: QueueResponseDto })
  findBySalon(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query('date') date: string,
  ): Promise<QueueResponseDto> {
    return this.queueService.findBySalonAndDate(salonId, date);
  }

  // ─── Open queue ───────────────────────────────────────────────────────────

  /**
   * POST /queues
   * Opens a daily queue for a salon.
   * If the queue was previously closed, re-opens it.
   */
  @Post()
  @RequirePermissions(Permission.QUEUE_CREATE)
  @ApiOperation({
    summary: 'Open (create) a daily queue for a salon',
    description:
      'One queue per salon per day. Calling this on an already-created-but-closed queue re-opens it. ' +
      'Requires QUEUE_CREATE permission (SALON_OWNER, STAFF, SUPER_ADMIN).',
  })
  @ApiResponse({ status: 201, type: QueueResponseDto })
  @ApiResponse({ status: 409, description: 'Queue already open for this date' })
  create(
    @Body() dto: CreateQueueDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueResponseDto> {
    return this.queueService.openQueue(dto, requester);
  }

  // ─── Close queue ──────────────────────────────────────────────────────────

  @Patch(':id/close')
  @Roles(Role.SALON_OWNER, Role.SUPER_ADMIN)
  @RequirePermissions(Permission.QUEUE_CLOSE)
  @ApiOperation({
    summary: 'Close the queue for the day',
    description:
      'Sets isOpen=false and cancels all remaining WAITING entries. ' +
      'SALON_OWNER or SUPER_ADMIN only.',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiResponse({ status: 200, type: QueueResponseDto })
  closeQueue(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueResponseDto> {
    return this.queueService.closeQueue(id, requester);
  }

  // ─── Force reset ──────────────────────────────────────────────────────────

  @Patch(':id/force-reset')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force-reset a queue — cancel all waiting entries (SUPER_ADMIN only)',
    description:
      'Cancels all WAITING entries. IN_PROGRESS entries are not affected. ' +
      'Clears the Redis sorted set.',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiResponse({ status: 204 })
  forceReset(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.queueService.forceReset(id);
  }

  // ─── Join queue ───────────────────────────────────────────────────────────

  /**
   * POST /queues/:id/join
   * Customer joins the queue.
   * Returns a token number and estimated wait time.
   */
  @Post(':id/join')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Join a queue as a customer',
    description:
      'Issues a token number and returns estimated wait time. ' +
      'Restricted to CUSTOMER role — staff cannot join the queues they manage.',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiResponse({ status: 201, type: QueueEntryResponseDto })
  @ApiResponse({ status: 400, description: 'Queue is closed or full' })
  @ApiResponse({ status: 409, description: 'Customer already in this queue' })
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinQueueDto,
    @CurrentUser('sub') userId: string,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.join(id, userId, dto);
  }

  // ─── My position ──────────────────────────────────────────────────────────

  @Get(':id/my-position')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: "Get the customer's live position in the queue",
    description:
      'Returns live position (ZRANK from Redis), people ahead, and current EWT. ' +
      'Returns 404 if the customer is not in this queue.',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiResponse({ status: 200, type: UserPositionDto })
  getMyPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<UserPositionDto> {
    return this.queueService.getMyPosition(id, userId);
  }

  // ─── Call next ────────────────────────────────────────────────────────────

  /**
   * PATCH /queues/:id/call-next
   * Transitions the next WAITING entry → CALLED.
   * Uses Redis sorted set for O(log N) lookup of the next customer.
   */
  @Patch(':id/call-next')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Call the next waiting customer',
    description:
      'Dequeues the front of the waiting list (WAITING → CALLED). ' +
      'Updates queue.currentServingPosition and invalidates state cache. ' +
      'Requires QUEUE_MANAGE permission (STAFF, SALON_OWNER, SUPER_ADMIN).',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiResponse({ status: 200, type: QueueEntryResponseDto })
  callNext(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.callNext(id, requester);
  }

  // ─── Start service ────────────────────────────────────────────────────────

  @Patch('entries/:entryId/start')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark a called customer as in-service (CALLED → IN_PROGRESS)',
    description:
      'Records serviceStartedAt. Used to calculate actual service duration ' +
      'for the rolling average EWT.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiResponse({ status: 200, type: QueueEntryResponseDto })
  startService(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.startService(entryId, requester);
  }

  // ─── Complete service ─────────────────────────────────────────────────────

  @Patch('entries/:entryId/complete')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark service as completed (IN_PROGRESS → COMPLETED)',
    description:
      'Records completedAt, increments queue.totalServed, and updates the ' +
      'rolling average service duration in Redis.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiResponse({ status: 200, type: QueueEntryResponseDto })
  complete(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.complete(entryId, requester);
  }

  // ─── No-show ──────────────────────────────────────────────────────────────

  @Patch('entries/:entryId/no-show')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark a called/in-progress customer as no-show',
    description: 'Valid from CALLED or IN_PROGRESS status. Terminal state.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiResponse({ status: 200, type: QueueEntryResponseDto })
  noShow(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.markNoShow(entryId, requester);
  }

  // ─── Cancel entry ─────────────────────────────────────────────────────────

  /**
   * PATCH /queues/entries/:entryId/cancel
   * Customers cancel their own entry. Staff can cancel any entry in their salon.
   * Valid from WAITING or CALLED status only.
   */
  @Patch('entries/:entryId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel a queue entry',
    description:
      'Customers can cancel their own entry. Staff/SALON_OWNER can cancel any. ' +
      'Removes the entry from the Redis sorted set so positions update instantly.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiResponse({ status: 204 })
  cancel(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: CancelEntryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.queueService.cancel(entryId, user.sub, user.role, dto);
  }

  // ─── List entries (management) ────────────────────────────────────────────

  @Get(':id/entries')
  @RequirePermissions(Permission.QUEUE_READ)
  @ApiOperation({
    summary: 'List all entries in a queue',
    description: 'Optionally filter by ?status=waiting|called|in_progress|completed|no_show|cancelled',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiQuery({ name: 'status', enum: QueueStatus, required: false })
  @ApiResponse({ status: 200, type: [QueueEntryResponseDto] })
  getEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: QueueStatus,
  ): Promise<QueueEntryResponseDto[]> {
    return this.queueService.getEntries(id, status);
  }
}
