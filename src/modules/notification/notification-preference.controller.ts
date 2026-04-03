import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationPreferenceService } from './notification-preference.service';
import { BulkUpsertPreferencesDto, UpsertPreferenceDto } from './dto/notification-preference.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notification-preferences')
export class NotificationPreferenceController {
  constructor(private readonly prefService: NotificationPreferenceService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notification preferences' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.prefService.findForUser(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Bulk upsert notification preferences' })
  upsertMany(
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkUpsertPreferencesDto,
  ) {
    return this.prefService.upsertMany(userId, dto.preferences);
  }

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
