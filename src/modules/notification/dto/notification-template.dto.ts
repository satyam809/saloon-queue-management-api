import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

/**
 * Payload for creating or updating a notification template.
 *
 * Templates define the title and body text used when generating notifications
 * of a given type/channel combination. Placeholders in the form `{{variableName}}`
 * are replaced by the notification service at dispatch time with values from the
 * notification's `metadata` payload.
 */
export class UpsertNotificationTemplateDto {
  /**
   * Semantic notification type this template applies to
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   * Must be a valid {@link NotificationType} enum value.
   */
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  /**
   * Delivery channel this template applies to
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   * Must be a valid {@link NotificationChannel} enum value.
   */
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  /**
   * Mustache-style template string for the notification title.
   * Use `{{variableName}}` placeholders for values injected at render time
   * (e.g. `"Your turn at {{salonName}}"`).
   * Must be a non-empty string.
   */
  @ApiProperty({
    example: 'Your turn at {{salonName}}',
    description: 'Title with {{variable}} placeholders',
  })
  @IsNotEmpty()
  @IsString()
  titleTemplate: string;

  /**
   * Mustache-style template string for the notification body.
   * Use `{{variableName}}` placeholders for values injected at render time
   * (e.g. `"Hi {{userName}}, token #{{tokenNumber}} is now being called."`).
   * Must be a non-empty string.
   */
  @ApiProperty({
    example: 'Hi {{userName}}, token #{{tokenNumber}} is now being called.',
    description: 'Body with {{variable}} placeholders',
  })
  @IsNotEmpty()
  @IsString()
  bodyTemplate: string;

  /**
   * Whether this template is active and eligible to be used when generating
   * notifications. Inactive templates are ignored by the dispatch engine.
   * Defaults to `true` when omitted.
   */
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Read model returned by the API when representing a stored notification
 * template record. Used as the response shape for template queries and upserts.
 */
export class NotificationTemplateResponseDto {
  /** Unique identifier (UUID v4) of the template record. */
  id: string;

  /**
   * Semantic notification type this template applies to
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   */
  type: NotificationType;

  /**
   * Delivery channel this template applies to
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   */
  channel: NotificationChannel;

  /**
   * Stored title template string with `{{variable}}` placeholders
   * as originally submitted via {@link UpsertNotificationTemplateDto}.
   */
  titleTemplate: string;

  /**
   * Stored body template string with `{{variable}}` placeholders
   * as originally submitted via {@link UpsertNotificationTemplateDto}.
   */
  bodyTemplate: string;

  /**
   * Whether this template is currently active.
   * `true` means the dispatch engine may use this template; `false` means it
   * is disabled and will be skipped.
   */
  isActive: boolean;

  /** Timestamp of the most recent update to this template record. */
  updatedAt: Date;
}
