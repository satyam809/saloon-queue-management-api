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

class UnreadCountDto {
  @ApiProperty({ example: 7, description: 'Number of unread notifications' })
  count: number;
}

@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ─── List notifications ────────────────────────────────────────────────────

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
