import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query parameters for listing a user's notifications.
 *
 * Extends {@link PaginationDto} to inherit `page` and `limit` fields.
 * All filter fields are optional — omitting a field means no filter is applied
 * for that dimension, returning notifications of all types/channels/read-states.
 */
export class ListNotificationsDto extends PaginationDto {
  /**
   * Filter notifications by their semantic type
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   * Must be a valid {@link NotificationType} enum value when provided.
   */
  @ApiPropertyOptional({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  /**
   * Filter notifications by the delivery channel they were sent through
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   * Must be a valid {@link NotificationChannel} enum value when provided.
   */
  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  /**
   * Filter notifications by read status.
   * - `true`  — return only notifications the user has already read.
   * - `false` — return only unread notifications.
   *
   * The transformer coerces the query-string value `"true"` / `"false"` to
   * the corresponding boolean before validation.
   */
  @ApiPropertyOptional({ description: 'Filter by read status' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;
}
