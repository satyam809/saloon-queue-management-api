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
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiConflictErrors,
  ApiCreatedWrapped,
  ApiOkArrayWrapped,
  ApiOkWrapped,
} from '@common/swagger/decorators';
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

/**
 * REST controller for queue management.
 *
 * Base route: /queues
 *
 * Endpoint groups:
 * - Public live status  — no auth, served from Redis cache
 * - Queue lifecycle     — open, close, force-reset (STAFF / SALON_OWNER / SUPER_ADMIN)
 * - Customer operations — join, cancel, get my position (CUSTOMER)
 * - Staff transitions   — call next, start, complete, no-show (QUEUE_MANAGE permission)
 * - Management reads    — list entries with optional status filter (QUEUE_READ permission)
 */
@ApiTags('Queue')
@ApiBearerAuth('bearer')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // ─── Public: live status ──────────────────────────────────────────────────

  /**
   * GET /queues/salon/:salonId/live?date=YYYY-MM-DD
   * No auth required — intended for public displays, walk-in customers.
   * Returns cached queue state (Redis hit = no DB query).
   *
   * @param salonId - UUID of the salon whose live queue state is requested
   * @param date - Calendar date in YYYY-MM-DD format
   * @returns Live queue state snapshot including waiting count, current token, and EWT
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
  @ApiOkWrapped(LiveQueueStateDto)
  getLiveState(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query('date') date: string,
  ): Promise<LiveQueueStateDto> {
    return this.queueService.getLiveState(salonId, date);
  }

  // ─── Authenticated: queue lookup ──────────────────────────────────────────

  /**
   * GET /queues/salon/:salonId?date=YYYY-MM-DD
   * Retrieves the queue record for a specific salon on a given date.
   * Requires QUEUE_READ permission.
   *
   * @param salonId - UUID of the salon
   * @param date - Calendar date in YYYY-MM-DD format
   * @returns Queue record including open/closed status and serving position
   */
  @Get('salon/:salonId')
  @RequirePermissions(Permission.QUEUE_READ)
  @ApiOperation({ summary: 'Get queue record for a salon on a specific date' })
  @ApiParam({ name: 'salonId', description: 'Salon UUID' })
  @ApiQuery({ name: 'date', example: '2026-03-30', required: true })
  @ApiOkWrapped(QueueResponseDto)
  @ApiCommonErrors()
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
   *
   * @param dto - Contains salonId and the target date for the queue
   * @param requester - JWT payload of the authenticated user making the request
   * @returns The created or re-opened queue record
   */
  @Post()
  @RequirePermissions(Permission.QUEUE_CREATE)
  @ApiOperation({
    summary: 'Open (create) a daily queue for a salon',
    description:
      'One queue per salon per day. Calling this on an already-created-but-closed queue re-opens it. ' +
      'Requires QUEUE_CREATE permission (SALON_OWNER, STAFF, SUPER_ADMIN).',
  })
  @ApiCreatedWrapped(QueueResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  create(
    @Body() dto: CreateQueueDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueResponseDto> {
    return this.queueService.openQueue(dto, requester);
  }

  // ─── Close queue ──────────────────────────────────────────────────────────

  /**
   * PATCH /queues/:id/close
   * Closes the queue for the day, cancelling all remaining WAITING entries.
   * Requires SALON_OWNER or SUPER_ADMIN role.
   *
   * @param id - UUID of the queue to close
   * @param requester - JWT payload of the authenticated user making the request
   * @returns The updated queue record with isOpen=false
   */
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
  @ApiOkWrapped(QueueResponseDto)
  @ApiCommonErrors()
  closeQueue(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueResponseDto> {
    return this.queueService.closeQueue(id, requester);
  }

  // ─── Force reset ──────────────────────────────────────────────────────────

  /**
   * PATCH /queues/:id/force-reset
   * Cancels all WAITING entries and clears the Redis sorted set.
   * IN_PROGRESS entries are not affected. SUPER_ADMIN only.
   *
   * @param id - UUID of the queue to reset
   * @returns void — 204 No Content on success
   */
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
  @ApiNoContentResponse({ description: 'Queue reset — all WAITING entries cancelled.' })
  @ApiCommonErrors()
  forceReset(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.queueService.forceReset(id);
  }

  // ─── Join queue ───────────────────────────────────────────────────────────

  /**
   * POST /queues/:id/join
   * Customer joins the queue.
   * Returns a token number and estimated wait time.
   * Restricted to CUSTOMER role — staff cannot join the queues they manage.
   *
   * @param id - UUID of the queue to join
   * @param dto - Optional preferred barber, service, and notes
   * @param userId - UUID of the authenticated customer (extracted from JWT)
   * @returns The new queue entry with token number, position, and EWT
   * @throws ConflictException if the customer is already in this queue
   * @throws BadRequestException if the queue is closed or at capacity
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
  @ApiCreatedWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinQueueDto,
    @CurrentUser('sub') userId: string,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.join(id, userId, dto);
  }

  // ─── My position ──────────────────────────────────────────────────────────

  /**
   * GET /queues/:id/my-position
   * Returns the authenticated customer's live position in the waiting line.
   * Position is derived from Redis ZRANK — O(log N), no DB hit on cache hit.
   *
   * @param id - UUID of the queue
   * @param userId - UUID of the authenticated customer (extracted from JWT)
   * @returns Live position, people ahead, and current EWT; or 404 if not in queue
   */
  @Get(':id/my-position')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: "Get the customer's live position in the queue",
    description:
      'Returns live position (ZRANK from Redis), people ahead, and current EWT. ' +
      'Returns 404 if the customer is not in this queue.',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiOkWrapped(UserPositionDto)
  @ApiCommonErrors()
  getMyPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<UserPositionDto> {
    return this.queueService.getMyPosition(id, userId);
  }

  // ─── Call next ────────────────────────────────────────────────────────────

  /**
   * PATCH /queues/:id/call-next
   * Transitions the next WAITING entry to CALLED.
   * Uses a Redis Lua script for O(log N) atomic pop from the sorted set,
   * preventing two staff members from calling the same customer concurrently.
   * Requires QUEUE_MANAGE permission.
   *
   * @param id - UUID of the queue
   * @param requester - JWT payload of the staff member calling next
   * @returns The queue entry that was just called
   * @throws NotFoundException if no customers are waiting
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
  @ApiOkWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
  callNext(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.callNext(id, requester);
  }

  // ─── Start service ────────────────────────────────────────────────────────

  /**
   * PATCH /queues/entries/:entryId/start
   * Marks a called customer as in-service (CALLED → IN_PROGRESS).
   * Records serviceStartedAt for actual service duration tracking.
   * Requires QUEUE_MANAGE permission.
   *
   * @param entryId - UUID of the queue entry to start service on
   * @param requester - JWT payload of the staff member starting service
   * @returns The updated queue entry with status IN_PROGRESS
   * @throws BadRequestException if the entry is not in CALLED status
   */
  @Patch('entries/:entryId/start')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark a called customer as in-service (CALLED → IN_PROGRESS)',
    description:
      'Records serviceStartedAt. Used to calculate actual service duration ' +
      'for the rolling average EWT.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiOkWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
  startService(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.startService(entryId, requester);
  }

  // ─── Complete service ─────────────────────────────────────────────────────

  /**
   * PATCH /queues/entries/:entryId/complete
   * Marks service as completed (IN_PROGRESS → COMPLETED).
   * Records completedAt, increments queue.totalServed, and updates the
   * rolling average service duration in Redis for more accurate EWT.
   * Requires QUEUE_MANAGE permission.
   *
   * @param entryId - UUID of the queue entry to complete
   * @param requester - JWT payload of the staff member completing service
   * @returns The updated queue entry with status COMPLETED
   * @throws BadRequestException if the entry is not in IN_PROGRESS status
   */
  @Patch('entries/:entryId/complete')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark service as completed (IN_PROGRESS → COMPLETED)',
    description:
      'Records completedAt, increments queue.totalServed, and updates the ' +
      'rolling average service duration in Redis.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiOkWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
  complete(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    return this.queueService.complete(entryId, requester);
  }

  // ─── No-show ──────────────────────────────────────────────────────────────

  /**
   * PATCH /queues/entries/:entryId/no-show
   * Marks a called or in-progress customer as a no-show. Terminal state.
   * Valid only from CALLED or IN_PROGRESS status.
   * Requires QUEUE_MANAGE permission.
   *
   * @param entryId - UUID of the queue entry to mark as no-show
   * @param requester - JWT payload of the staff member marking the no-show
   * @returns The updated queue entry with status NO_SHOW
   * @throws BadRequestException if the entry is not in CALLED or IN_PROGRESS status
   */
  @Patch('entries/:entryId/no-show')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark a called/in-progress customer as no-show',
    description: 'Valid from CALLED or IN_PROGRESS status. Terminal state.',
  })
  @ApiParam({ name: 'entryId', description: 'QueueEntry UUID' })
  @ApiOkWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
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
   * Immediately removes the entry from the Redis sorted set so positions update.
   *
   * @param entryId - UUID of the queue entry to cancel
   * @param dto - Optional cancellation reason
   * @param user - JWT payload of the user requesting cancellation
   * @returns void — 204 No Content on success
   * @throws ForbiddenException if a customer tries to cancel another customer's entry
   * @throws BadRequestException if the entry is not in a cancellable status
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
  @ApiNoContentResponse({ description: 'Entry cancelled.' })
  @ApiCommonErrors()
  cancel(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: CancelEntryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.queueService.cancel(entryId, user.sub, user.role, dto);
  }

  // ─── List entries (management) ────────────────────────────────────────────

  /**
   * GET /queues/:id/entries?status=
   * Lists all entries in a queue, optionally filtered by status.
   * Results are ordered by position ASC, then checkedInAt ASC.
   * Requires QUEUE_READ permission.
   *
   * @param id - UUID of the queue whose entries are requested
   * @param status - Optional status filter (waiting, called, in_progress, completed, no_show, cancelled)
   * @returns Array of queue entry response DTOs in queue order
   */
  @Get(':id/entries')
  @RequirePermissions(Permission.QUEUE_READ)
  @ApiOperation({
    summary: 'List all entries in a queue',
    description: 'Optionally filter by ?status=waiting|called|in_progress|completed|no_show|cancelled',
  })
  @ApiParam({ name: 'id', description: 'Queue UUID' })
  @ApiQuery({ name: 'status', enum: QueueStatus, required: false })
  @ApiOkArrayWrapped(QueueEntryResponseDto)
  @ApiCommonErrors()
  getEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: QueueStatus,
  ): Promise<QueueEntryResponseDto[]> {
    return this.queueService.getEntries(id, status);
  }
}
