import { IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';

/**
 * Payload for creating or updating a single notification preference entry.
 *
 * A preference is the intersection of a notification type and a delivery
 * channel — users can independently mute or enable each combination.
 */
export class UpsertPreferenceDto {
  /**
   * Semantic notification type this preference applies to
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   * Must be a valid {@link NotificationType} enum value.
   */
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  /**
   * Delivery channel this preference applies to
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   * Must be a valid {@link NotificationChannel} enum value.
   */
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  /**
   * Whether notifications of the given `type` should be delivered via `channel`.
   * - `true`  — the user wants to receive this type/channel combination.
   * - `false` — the user has muted this type/channel combination.
   */
  @ApiProperty({ description: 'true = receive, false = mute' })
  @IsBoolean()
  isEnabled: boolean;
}

/**
 * Payload for performing a bulk upsert of multiple notification preferences
 * in a single request.
 *
 * The service will insert or update each entry in `preferences` atomically,
 * preserving any existing preferences not included in the list.
 */
export class BulkUpsertPreferencesDto {
  /**
   * Array of one or more preference entries to upsert.
   * Each entry must be a valid {@link UpsertPreferenceDto}.
   */
  @ApiProperty({ type: [UpsertPreferenceDto] })
  preferences: UpsertPreferenceDto[];
}

/**
 * Read model returned by the API when representing a stored notification
 * preference record. Used as the response shape for preference queries.
 */
export class NotificationPreferenceResponseDto {
  /**
   * The notification type this preference controls
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   */
  type: NotificationType;

  /**
   * The delivery channel this preference controls
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   */
  channel: NotificationChannel;

  /**
   * Current enabled state of this type/channel combination for the user.
   * `true` means the user will receive these notifications; `false` means muted.
   */
  isEnabled: boolean;
}
