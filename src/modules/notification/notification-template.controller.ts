import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationTemplateService } from './notification-template.service';
import { UpsertNotificationTemplateDto } from './dto/notification-template.dto';

/**
 * Admin-only endpoint for managing notification templates.
 * Guard with @Roles(Role.SUPER_ADMIN) / RolesGuard at the module or app level.
 */
@ApiTags('Notification Templates (Admin)')
@ApiBearerAuth()
@Controller('notification-templates')
export class NotificationTemplateController {
  constructor(private readonly templateService: NotificationTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all notification templates' })
  findAll() {
    return this.templateService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a template (upsert by type+channel)' })
  upsert(@Body() dto: UpsertNotificationTemplateDto) {
    return this.templateService.upsert(dto);
  }

  @Post('seed-missing')
  @ApiOperation({ summary: 'Add any default templates that are missing' })
  seedMissing() {
    return this.templateService.seedMissing();
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a template' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.toggleActive(id, true);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a template (stops dispatching on this channel)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.toggleActive(id, false);
  }
}
