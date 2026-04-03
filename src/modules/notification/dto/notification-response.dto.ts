import { NotificationChannel, NotificationPriority, NotificationType } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;

  static from(n: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id                = n.id;
    dto.type              = n.type;
    dto.channel           = n.channel;
    dto.priority          = n.priority;
    dto.title             = n.title;
    dto.body              = n.body;
    dto.isRead            = n.isRead;
    dto.readAt            = n.readAt;
    dto.sentAt            = n.sentAt;
    dto.relatedEntityType = n.relatedEntityType;
    dto.relatedEntityId   = n.relatedEntityId;
    dto.metadata          = n.metadata;
    dto.createdAt         = n.createdAt;
    return dto;
  }
}
