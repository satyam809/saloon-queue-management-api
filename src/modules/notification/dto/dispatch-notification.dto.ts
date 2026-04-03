import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationPriority, NotificationType } from '@common/enums/notification.enum';

export class DispatchNotificationDto {
  @ApiProperty({ description: 'Recipient user ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  /**
   * Template variable substitutions.
   * Keys must match {{placeholders}} in the template.
   * Example: { salonName: 'The Style Studio', tokenNumber: 7 }
   */
  @ApiPropertyOptional({ description: 'Template interpolation variables' })
  @IsObject()
  @IsOptional()
  data?: Record<string, string | number>;

  /**
   * Extra payload stored on the notification row for deep-linking.
   * Not used in template rendering.
   */
  @ApiPropertyOptional({ description: 'Deep-link payload stored on the notification' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Entity type this notification concerns (e.g. queue_entry)' })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  relatedEntityType?: string;

  @ApiPropertyOptional({ description: 'UUID of the related entity' })
  @IsUUID()
  @IsOptional()
  relatedEntityId?: string;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  /**
   * When set, only this channel is dispatched regardless of templates.
   * Useful for forced in-app system messages.
   */
  @ApiPropertyOptional({ enum: NotificationChannel, description: 'Force a single channel' })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;
}
