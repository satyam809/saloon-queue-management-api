import { IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

export class UpsertPreferenceDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'true = receive, false = mute' })
  @IsBoolean()
  isEnabled: boolean;
}

export class BulkUpsertPreferencesDto {
  @ApiProperty({ type: [UpsertPreferenceDto] })
  preferences: UpsertPreferenceDto[];
}

export class NotificationPreferenceResponseDto {
  type: NotificationType;
  channel: NotificationChannel;
  isEnabled: boolean;
}
