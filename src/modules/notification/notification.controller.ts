import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiOkArrayWrapped,
  ApiOkWrapped,
} from '@common/swagger/decorators';

// ─── Unread-count response ─────────────────────────────────────────────────

/**
 * Lightweight response shape returned by the unread-count endpoint.
 */
class UnreadCountDto {
  /** Total number of notifications that the authenticated user has not yet read. */
  @ApiProperty({ example: 7, description: 'Number of unread notifications' })
  count: number;
}

/**
 * REST controller that exposes notification management endpoints for the
 * currently authenticated user.
 *
 * Base route: `/notifications`
 *
 * All routes require a valid JWT bearer token. Notifications are always scoped
 * to the authenticated user — callers cannot access another user's notifications
 * through this controller.
 */
@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationController {
  /**
   * @param notificationService - Service that handles all notification persistence and business logic.
   */
  constructor(private readonly notificationService: NotificationService) {}

  // ─── List notifications ────────────────────────────────────────────────────

  /**
   * GET /notifications
   *
   * Returns a paginated list of notifications for the authenticated user,
   * ordered newest first (`createdAt DESC`).
   *
   * Supported query parameters:
   * - `type`    — filter by notification type (e.g. `QUEUE_CALLED`)
   * - `channel` — filter by delivery channel (e.g. `EMAIL`)
   * - `isRead`  — filter by read status (`true` or `false`)
   * - `page` / `limit` — pagination controls
   *
   * @param userId  - UUID of the authenticated user (injected from JWT).
   * @param filters - Parsed and validated query parameters.
   * @returns Paginated array of {@link NotificationResponseDto}.
   */
  @Get()
  @ApiOperation({
    summary: 'Get my notifications',
    description:
      'Returns paginated notifications for the authenticated user. ' +
      'Filter by ?type=, ?channel=, or ?isRead=. Newest first.',
  })
  @ApiOkArrayWrapped(NotificationResponseDto)
  @ApiAuthErrors()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() filters: ListNotificationsDto,
  ) {
    return this.notificationService.findForUser(userId, filters);
  }

  // ─── Unread count ──────────────────────────────────────────────────────────

  /**
   * GET /notifications/unread-count
   *
   * Returns the total count of unread notifications for the authenticated user.
   * Useful for displaying badge counters in client applications without fetching
   * the full notification list.
   *
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @returns An {@link UnreadCountDto} containing the unread notification count.
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Returns the number of unread notifications for the authenticated user.',
  })
  @ApiOkWrapped(UnreadCountDto)
  @ApiAuthErrors()
  unreadCount(@CurrentUser('sub') userId: string) {
    return this.notificationService.countUnread(userId);
  }

  // ─── Mark one as read ─────────────────────────────────────────────────────

  /**
   * PATCH /notifications/:id/read
   *
   * Marks a single notification as read by setting `isRead = true` and
   * recording `readAt` with the current timestamp. This operation is idempotent
   * — calling it multiple times on an already-read notification has no further
   * effect and always returns the current state.
   *
   * @param id     - UUID of the notification to mark as read.
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @returns The updated {@link NotificationResponseDto}.
   * @throws NotFoundException when no notification with `id` belongs to `userId`.
   */
  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark a notification as read',
    description: 'Sets isRead=true and records readAt. Idempotent — safe to call multiple times.',
  })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiOkWrapped(NotificationResponseDto)
  @ApiCommonErrors()
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationService.markAsRead(id, userId);
  }

  // ─── Mark all as read ─────────────────────────────────────────────────────

  /**
   * PATCH /notifications/read-all
   *
   * Bulk-marks every unread notification belonging to the authenticated user
   * as read in a single database operation. Returns the number of notification
   * records that were updated.
   *
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @returns An object indicating how many notifications were updated.
   */
  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Bulk-updates all unread notifications for the authenticated user.',
  })
  @ApiOkResponse({ description: 'Returns the number of notifications updated.' })
  @ApiAuthErrors()
  markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  // ─── Delete one ───────────────────────────────────────────────────────────

  /**
   * DELETE /notifications/:id
   *
   * Hard-deletes a single notification record. Only the owning user can delete
   * their own notifications — ownership is verified by matching both the `id`
   * and the `userId` from the JWT against the database record.
   *
   * Returns HTTP 204 No Content on success.
   *
   * @param id     - UUID of the notification to delete.
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @throws NotFoundException when no notification with `id` belongs to `userId`.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Hard-deletes the notification. Only the owner can delete their own notifications.',
  })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiNoContentResponse({ description: 'Notification deleted.' })
  @ApiCommonErrors()
  deleteOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationService.deleteOne(id, userId);
  }
}
