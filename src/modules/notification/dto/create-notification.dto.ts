import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@common/enums/notification.enum';

/**
 * Payload used to create a new notification record for a specific user.
 *
 * Typically consumed by internal services (e.g. queue, appointment, payment)
 * rather than directly by end-user clients.
 */
export class CreateNotificationDto {
  /**
   * UUID of the user who should receive this notification.
   * Must correspond to an existing `users.id` record.
   */
  @ApiProperty()
  @IsUUID()
  userId: string;

  /**
   * Semantic type of the notification that describes the triggering event
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   * Must be a valid {@link NotificationType} enum value.
   */
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  /**
   * Short, human-readable headline shown as the notification title
   * (e.g. `"Your turn is coming up!"`).
   * Must be a non-empty string.
   */
  @ApiProperty({ example: 'Your turn is coming up!' })
  @IsNotEmpty()
  @IsString()
  title: string;

  /**
   * Full descriptive text of the notification
   * (e.g. `"You are next in the queue."`).
   * Must be a non-empty string.
   */
  @ApiProperty({ example: 'You are next in the queue.' })
  @IsNotEmpty()
  @IsString()
  body: string;

  /**
   * Arbitrary key-value bag of supplementary data attached to the notification
   * (e.g. `{ tokenNumber: 5, salonName: "Cuts & Co" }`).
   * Optional — omit when no extra context is required.
   */
  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}
