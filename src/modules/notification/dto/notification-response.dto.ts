import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationPriority, NotificationType } from '@common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';

/**
 * Data Transfer Object returned by the API for all notification-related responses.
 *
 * Provides a serialisation-safe, flattened representation of a
 * {@link Notification} entity, including delivery metadata and optional
 * relational context fields.
 */
export class NotificationResponseDto {
  /** Unique identifier (UUID v4) of the notification record. */
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  /**
   * Semantic type of the notification describing the triggering event
   * (e.g. `QUEUE_CALLED`, `APPOINTMENT_REMINDER`).
   */
  @ApiProperty({ enum: NotificationType, example: NotificationType.QUEUE_CALLED })
  type: NotificationType;

  /**
   * Delivery channel through which this notification was (or will be) sent
   * (e.g. `IN_APP`, `EMAIL`, `SMS`).
   */
  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  /**
   * Dispatch priority that determines how urgently the notification should
   * be delivered relative to other pending notifications.
   */
  @ApiProperty({ enum: NotificationPriority, example: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  /** Short, human-readable headline displayed to the user (e.g. `"It's your turn!"`). */
  @ApiProperty({ example: "It's your turn!" })
  title: string;

  /**
   * Full descriptive body of the notification
   * (e.g. `"Token #12 — please proceed to the counter."`).
   */
  @ApiProperty({ example: 'Token #12 — please proceed to the counter.' })
  body: string;

  /**
   * Whether the user has already viewed/acknowledged this notification.
   * `false` on creation; becomes `true` after the user calls the mark-as-read endpoint.
   */
  @ApiProperty({ example: false })
  isRead: boolean;

  /**
   * Timestamp when the user marked this notification as read.
   * `null` while the notification remains unread.
   */
  @ApiPropertyOptional({ example: null, nullable: true })
  readAt: Date | null;

  /**
   * Timestamp when the notification was dispatched to the delivery channel.
   * `null` while the notification is pending delivery.
   */
  @ApiPropertyOptional({ example: '2026-04-03T10:30:00.000Z', nullable: true })
  sentAt: Date | null;

  /**
   * Entity type of the domain object this notification is about
   * (e.g. `queue_entry`, `appointment`).
   * `null` when the notification does not reference a specific entity.
   */
  @ApiPropertyOptional({ example: 'queue_entry', nullable: true })
  relatedEntityType: string | null;

  /**
   * UUID of the specific entity record this notification is about.
   * `null` when the notification does not reference a specific entity.
   */
  @ApiPropertyOptional({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', nullable: true })
  relatedEntityId: string | null;

  /**
   * Arbitrary key-value bag of supplementary data attached to the notification
   * (e.g. `{ tokenNumber: 12 }`).
   * `null` when no extra context was supplied at creation time.
   */
  @ApiPropertyOptional({ example: { tokenNumber: 12 }, nullable: true })
  metadata: Record<string, any> | null;

  /** Timestamp when the notification record was first created in the database. */
  @ApiProperty({ example: '2026-04-03T10:00:00.000Z' })
  createdAt: Date;

  /**
   * Factory method that maps a {@link Notification} entity to a
   * {@link NotificationResponseDto}.
   *
   * @param n - The raw Notification entity retrieved from the database.
   * @returns A populated {@link NotificationResponseDto} ready for serialisation.
   */
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
