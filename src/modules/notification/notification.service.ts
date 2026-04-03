import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { paginate } from '@shared/utils/pagination.util';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create(dto);
    return this.notificationRepo.save(notification);
  }

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

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()' })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();
  }

  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepo.count({ where: { userId, isRead: false } });
    return { count };
  }

  async deleteOne(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.notificationRepo.remove(notification);
  }
}
