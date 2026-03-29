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
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { JoinQueueDto } from './dto/join-queue.dto';

// ─── RBAC imports ────────────────────────────────────────────────────────────
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * Queue controller — demonstrates every RBAC pattern in one place.
 *
 * Pattern reference:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ @Public()                 → no auth required (unauthenticated access)  │
 * │ (no decorator)            → any authenticated user                      │
 * │ @Roles(...)               → user must BE one of the listed roles        │
 * │ @RequirePermissions(...)  → user's role must GRANT the listed caps      │
 * │ @Roles() + @RequirePerms  → BOTH conditions must pass (AND logic)       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
@ApiTags('Queue')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Insufficient role or permissions' })
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // ─── PATTERN 1: @Public() ──────────────────────────────────────────────
  // No auth required. Anyone — including unauthenticated users — can call this.
  // Useful for the customer-facing "is this salon busy?" display board.

  @Public()
  @Get('salon/:salonId/live')
  @ApiOperation({
    summary: 'Live queue status for a salon (public)',
    description:
      'Returns the current queue size and estimated wait. No authentication required ' +
      '— intended for public-facing displays and walk-in customers.',
  })
  @ApiQuery({ name: 'date', example: '2026-03-29', required: true })
  getLiveStatus(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query('date') date: string,
  ) {
    return this.queueService.findBySalonAndDate(salonId, date);
  }

  // ─── PATTERN 2: Authenticated, no role restriction ─────────────────────
  // Any logged-in user can view queue details.

  @Get('salon/:salonId')
  @ApiOperation({
    summary: 'Get queue for a salon on a specific date',
    description: 'Any authenticated user can view the full queue with entry details.',
  })
  @ApiQuery({ name: 'date', example: '2026-03-29', required: true })
  findBySalon(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query('date') date: string,
  ) {
    return this.queueService.findBySalonAndDate(salonId, date);
  }

  // ─── PATTERN 3: @RequirePermissions() ─────────────────────────────────
  // Capability-based gate. Any role that has QUEUE_CREATE can open a queue —
  // currently: SUPER_ADMIN, SALON_OWNER, STAFF.
  // Adding a new "manager" role only requires granting it QUEUE_CREATE
  // in role-permissions.map.ts — this controller doesn't change.

  @Post()
  @RequirePermissions(Permission.QUEUE_CREATE)
  @ApiOperation({
    summary: 'Open a new queue for a salon on a given date',
    description:
      'Requires QUEUE_CREATE permission. Granted to: SALON_OWNER, STAFF, SUPER_ADMIN.',
  })
  create(@Body() dto: CreateQueueDto) {
    return this.queueService.create(dto);
  }

  // ─── PATTERN 4: @Roles() — strict role gate ────────────────────────────
  // Use when the restriction is identity-based, not capability-based.
  // Only CUSTOMER can join (salon staff don't join their own queue).

  @Post(':id/join')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Join a queue as a customer',
    description:
      'Restricted to CUSTOMER role. Staff and owners cannot join the queue ' +
      'they manage.',
  })
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinQueueDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.queueService.join(id, userId, dto);
  }

  // ─── PATTERN 5: @RequirePermissions() on a management operation ────────
  // Staff and owners share the QUEUE_MANAGE capability. Keeps the route
  // decoupled from specific role names.

  @Patch(':id/call-next')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Call the next waiting customer',
    description:
      'Requires QUEUE_MANAGE permission. Granted to: SALON_OWNER, STAFF, SUPER_ADMIN.',
  })
  callNext(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.callNext(id);
  }

  @Patch('entries/:entryId/complete')
  @RequirePermissions(Permission.QUEUE_MANAGE)
  @ApiOperation({
    summary: 'Mark an in-progress entry as completed',
    description: 'Requires QUEUE_MANAGE permission.',
  })
  complete(@Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.queueService.complete(entryId);
  }

  // ─── PATTERN 6: @Roles() + @RequirePermissions() (AND logic) ──────────
  // Both conditions must pass simultaneously.
  // The user must BE a SALON_OWNER AND also have QUEUE_CLOSE permission.
  // SUPER_ADMIN bypasses both guards.

  @Patch(':id/close')
  @Roles(Role.SALON_OWNER)
  @RequirePermissions(Permission.QUEUE_CLOSE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Close the queue for the day',
    description:
      'Requires both SALON_OWNER role AND QUEUE_CLOSE permission. ' +
      'Staff cannot close the queue — only the owner can.',
  })
  close(@Param('id', ParseUUIDPipe) id: string) {
    // TODO: implement queue.service.close()
    return { id };
  }

  // ─── PATTERN 7: @CurrentUser() — ownership enforced in service ─────────
  // Guard passes for any authenticated user (CUSTOMER or higher).
  // The service layer checks that the entry belongs to the calling user.

  @Patch('entries/:entryId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel your own queue entry',
    description:
      'Any authenticated user can cancel, but the service enforces ownership ' +
      '— you can only cancel your own entry.',
  })
  cancel(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.queueService.cancel(entryId, userId);
  }

  // ─── PATTERN 8: @Roles(SUPER_ADMIN) — admin-only hard gate ────────────
  // Use for destructive or irreversible operations.

  @Patch(':id/force-reset')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force-reset a queue (admin only)',
    description:
      'Clears all waiting entries. Restricted to SUPER_ADMIN — no other role ' +
      'can perform this action regardless of their permissions.',
  })
  forceReset(@Param('id', ParseUUIDPipe) id: string) {
    // TODO: implement queue.service.forceReset()
    return { id };
  }

  // ─── PATTERN 9: @CurrentUser() full payload — role-conditional logic ───
  // The same endpoint behaves differently depending on the caller's role.
  // Guards pass for all authenticated users; branching happens in the service.

  @Get(':id/my-position')
  @ApiOperation({
    summary: 'Get position in queue or management view',
    description:
      'Customers see their own position and estimated wait. ' +
      'Staff/owners see the full management summary. ' +
      'No guard annotation needed — role-conditional logic lives in the service.',
  })
  getPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Service receives the full payload and branches on user.role internally
    // Example service method signature:
    //   getPositionOrSummary(queueId: string, user: JwtPayload)
    return { queueId: id, requestedBy: user.sub, role: user.role };
  }
}
