import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationPriority, NotificationType } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.QUEUE_CALLED })
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationPriority, example: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  @ApiProperty({ example: "It's your turn!" })
  title: string;

  @ApiProperty({ example: 'Token #12 — please proceed to the counter.' })
  body: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  readAt: Date | null;

  @ApiPropertyOptional({ example: '2026-04-03T10:30:00.000Z', nullable: true })
  sentAt: Date | null;

  @ApiPropertyOptional({ example: 'queue_entry', nullable: true })
  relatedEntityType: string | null;

  @ApiPropertyOptional({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', nullable: true })
  relatedEntityId: string | null;

  @ApiPropertyOptional({ example: { tokenNumber: 12 }, nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty({ example: '2026-04-03T10:00:00.000Z' })
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
