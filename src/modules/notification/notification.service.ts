import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { paginate } from '@shared/utils/pagination.util';

/**
 * Service responsible for all notification business logic and persistence.
 *
 * Provides CRUD-style operations on {@link Notification} entities, including
 * creation, paginated querying, read-status management, and deletion. All
 * query methods are automatically scoped to a single user to prevent
 * cross-user data leakage.
 */
@Injectable()
export class NotificationService {
  /**
   * @param notificationRepo - TypeORM repository for the {@link Notification} entity.
   */
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Creates and persists a new notification record.
   *
   * Typically called by internal services (queue, appointment, payment) rather
   * than directly by an HTTP controller.
   *
   * @param dto - Validated payload containing the recipient user, type, title, body, and optional metadata.
   * @returns The newly saved {@link Notification} entity.
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create(dto);
    return this.notificationRepo.save(notification);
  }

  /**
   * Returns a paginated list of notifications for a specific user.
   *
   * Applies optional filters for notification `type`, delivery `channel`, and
   * read status (`isRead`). Results are ordered by `createdAt DESC` (newest first).
   *
   * @param userId  - UUID of the user whose notifications should be returned.
   * @param filters - Pagination and filter parameters from {@link ListNotificationsDto}.
   * @returns A paginated response object containing {@link NotificationResponseDto} items.
   */
  async findForUser(userId: string, filters: ListNotificationsDto) {
    const where: Record<string, any> = { userId };
    if (filters.type    !== undefined) where['type']    = filters.type;
    if (filters.channel !== undefined) where['channel'] = filters.channel;
    if (filters.isRead  !== undefined) where['isRead']  = filters.isRead;

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      skip:  filters.skip,
      take:  filters.limit,
      order: { createdAt: 'DESC' },
    });

    return paginate(
      data.map(NotificationResponseDto.from),
      total,
      filters.page,
      filters.limit,
    );
  }

  /**
   * Marks a single notification as read for a specific user.
   *
   * Sets `isRead = true` and records `readAt` with the current timestamp.
   * If the notification is already marked as read the record is not re-saved,
   * making this operation effectively idempotent.
   *
   * @param id     - UUID of the notification to mark as read.
   * @param userId - UUID of the owning user (used to scope the lookup).
   * @returns The updated {@link NotificationResponseDto}.
   * @throws {NotFoundException} When no notification with `id` belongs to `userId`.
   */
  async markAsRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }

    return NotificationResponseDto.from(notification);
  }

  /**
   * Bulk-marks all unread notifications belonging to a specific user as read.
   *
   * Executes a single `UPDATE` query for efficiency, setting `isRead = true`
   * and `readAt = NOW()` on every record where `userId` matches and
   * `isRead = false`.
   *
   * @param userId - UUID of the user whose unread notifications should be updated.
   * @returns A promise that resolves when the bulk update completes.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()' })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();
  }

  /**
   * Returns the number of unread notifications for a specific user.
   *
   * Uses a `COUNT` query rather than fetching full records for efficiency.
   *
   * @param userId - UUID of the user whose unread count should be computed.
   * @returns An object of shape `{ count: number }`.
   */
  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepo.count({ where: { userId, isRead: false } });
    return { count };
  }

  /**
   * Hard-deletes a single notification record.
   *
   * Ownership is verified by matching both `id` and `userId` — a user cannot
   * delete another user's notification.
   *
   * @param id     - UUID of the notification to delete.
   * @param userId - UUID of the owning user (used to scope the lookup).
   * @returns A promise that resolves when the record has been removed.
   * @throws {NotFoundException} When no notification with `id` belongs to `userId`.
   */
  async deleteOne(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.notificationRepo.remove(notification);
  }
}
