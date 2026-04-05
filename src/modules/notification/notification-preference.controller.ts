import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationPreferenceService } from './notification-preference.service';
import { BulkUpsertPreferencesDto, UpsertPreferenceDto } from './dto/notification-preference.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

/**
 * REST controller that manages per-user notification preferences.
 *
 * Base route: `/notification-preferences`
 *
 * All routes require a valid JWT bearer token. Preferences are always scoped
 * to the currently authenticated user — callers cannot read or modify another
 * user's preferences through this controller.
 */
@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notification-preferences')
export class NotificationPreferenceController {
  /**
   * @param prefService - Service that handles persistence of notification preferences.
   */
  constructor(private readonly prefService: NotificationPreferenceService) {}

  /**
   * GET /notification-preferences
   *
   * Returns all notification preference records stored for the currently
   * authenticated user, covering every type/channel combination that has
   * been explicitly set.
   *
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @returns Array of {@link NotificationPreferenceResponseDto} for the caller.
   */
  @Get()
  @ApiOperation({ summary: 'Get my notification preferences' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.prefService.findForUser(userId);
  }

  /**
   * PUT /notification-preferences
   *
   * Performs a bulk upsert of notification preferences for the currently
   * authenticated user. Each entry in the request body is individually
   * inserted or updated based on the `(userId, type, channel)` composite key.
   * Existing preferences not included in the request body are left unchanged.
   *
   * @param userId - UUID of the authenticated user (injected from JWT).
   * @param dto    - Bulk payload containing one or more preference entries.
   * @returns Array of upserted {@link NotificationPreferenceResponseDto} records.
   */
  @Put()
  @ApiOperation({ summary: 'Bulk upsert notification preferences' })
  upsertMany(
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkUpsertPreferencesDto,
  ) {
    return this.prefService.upsertMany(userId, dto.preferences);
  }

  /**
   * PATCH /notification-preferences/:type/:channel
   *
   * Toggles (enables or disables) a single notification preference identified
   * by the combination of `type` and `channel` for the authenticated user.
   * Creates the preference record if it does not yet exist.
   *
   * @param userId  - UUID of the authenticated user (injected from JWT).
   * @param type    - Notification type path parameter (e.g. `QUEUE_CALLED`).
   * @param channel - Notification channel path parameter (e.g. `EMAIL`).
   * @param dto     - Body containing only the `isEnabled` flag to apply.
   * @returns The upserted {@link NotificationPreferenceResponseDto} record.
   */
  @Patch(':type/:channel')
  @ApiOperation({ summary: 'Toggle a single type+channel preference' })
  upsertOne(
    @CurrentUser('sub') userId: string,
    @Param('type') type: NotificationType,
    @Param('channel') channel: NotificationChannel,
    @Body() dto: Pick<UpsertPreferenceDto, 'isEnabled'>,
  ) {
    return this.prefService.upsertOne(userId, { type, channel, isEnabled: dto.isEnabled });
  }
}
