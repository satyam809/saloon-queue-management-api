import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';
import { PaginationDto } from '@common/dto/pagination.dto';

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;
}
