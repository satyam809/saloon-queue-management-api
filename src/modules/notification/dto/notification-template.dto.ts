import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

export class UpsertNotificationTemplateDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    example: 'Your turn at {{salonName}}',
    description: 'Title with {{variable}} placeholders',
  })
  @IsNotEmpty()
  @IsString()
  titleTemplate: string;

  @ApiProperty({
    example: 'Hi {{userName}}, token #{{tokenNumber}} is now being called.',
    description: 'Body with {{variable}} placeholders',
  })
  @IsNotEmpty()
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class NotificationTemplateResponseDto {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  updatedAt: Date;
}
