import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationPreference } from './entities/notification-preference.entity';

// Services
import { NotificationService } from './notification.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

// Channel adapters
import { InAppChannelAdapter } from './channels/in-app.channel';
import { EmailChannelAdapter } from './channels/email.channel';
import { SmsChannelAdapter } from './channels/sms.channel';
import { PushChannelAdapter } from './channels/push.channel';

// Controllers
import { NotificationController } from './notification.controller';
import { NotificationTemplateController } from './notification-template.controller';
import { NotificationPreferenceController } from './notification-preference.controller';

/**
 * NotificationModule — full-stack notification system.
 *
 * Responsibilities:
 * - Persisting notification rows (NotificationService).
 * - Rendering and dispatching across IN_APP / EMAIL / SMS / PUSH channels
 *   (NotificationDispatcherService + channel adapters).
 * - Managing per-user opt-in/opt-out preferences (NotificationPreferenceService).
 * - Admin CRUD for notification templates (NotificationTemplateService).
 *
 * Exports:
 * - NotificationService — read / mark-read / delete for the notification inbox.
 * - NotificationDispatcherService — import NotificationModule in any feature
 *   module that needs to trigger notifications (e.g. QueueModule, AppointmentModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      NotificationPreference,
    ]),
  ],
  controllers: [
    NotificationController,
    NotificationTemplateController,
    NotificationPreferenceController,
  ],
  providers: [
    // Core
    NotificationService,
    NotificationTemplateService,
    NotificationPreferenceService,
    NotificationDispatcherService,
    // Channel adapters
    InAppChannelAdapter,
    EmailChannelAdapter,
    SmsChannelAdapter,
    PushChannelAdapter,
  ],
  exports: [
    NotificationService,
    NotificationDispatcherService,  // import NotificationModule to trigger notifications from other modules
  ],
})
export class NotificationModule {}
