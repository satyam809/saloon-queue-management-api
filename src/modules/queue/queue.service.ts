import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from './entities/queue.entity';
import { QueueEntry } from './entities/queue-entry.entity';
import { CreateQueueDto } from './dto/create-queue.dto';
import { JoinQueueDto } from './dto/join-queue.dto';
import { RedisService } from '@shared/services/redis.service';
import { QUEUE_CACHE_KEY, CACHE_TTL } from '@shared/constants/app.constants';
import { QueueStatus } from '@common/enums/status.enum';
import { SalonService } from '@modules/salon/salon.service';

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(QueueEntry)
    private readonly entryRepo: Repository<QueueEntry>,
    private readonly salonService: SalonService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateQueueDto): Promise<Queue> {
    const existing = await this.queueRepo.findOne({
      where: { salonId: dto.salonId, date: dto.date },
    });
    if (existing) throw new ConflictException('Queue already exists for this date');

    const queue = this.queueRepo.create(dto);
    return this.queueRepo.save(queue);
  }

  async findBySalonAndDate(salonId: string, date: string): Promise<Queue> {
    const cacheKey = QUEUE_CACHE_KEY.SALON_QUEUE(salonId);
    const cached = await this.redisService.getJson<Queue>(cacheKey);
    if (cached) return cached;

    const queue = await this.queueRepo.findOne({
      where: { salonId, date },
      relations: ['entries'],
    });
    if (!queue) throw new NotFoundException('Queue not found for this date');

    await this.redisService.setJson(cacheKey, queue, CACHE_TTL.SHORT);
    return queue;
  }

  async join(queueId: string, userId: string, dto: JoinQueueDto): Promise<QueueEntry> {
    const queue = await this.queueRepo.findOne({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    if (!queue.isOpen) throw new BadRequestException('Queue is closed');

    const salon = await this.salonService.findOne(queue.salonId);

    const activeCount = await this.entryRepo.count({
      where: { queueId, status: QueueStatus.WAITING },
    });
    if (activeCount >= salon.maxQueueSize) {
      throw new BadRequestException('Queue is full');
    }

    const alreadyJoined = await this.entryRepo.findOne({
      where: { queueId, userId, status: QueueStatus.WAITING },
    });
    if (alreadyJoined) throw new ConflictException('Already in queue');

    const position = activeCount + 1;
    const estimatedWaitMinutes = position * salon.avgServiceDurationMinutes;

    const entry = this.entryRepo.create({
      queueId,
      userId,
      position,
      estimatedWaitMinutes,
      notes: dto.notes,
    });

    await this.redisService.del(QUEUE_CACHE_KEY.SALON_QUEUE(queue.salonId));
    return this.entryRepo.save(entry);
  }

  async callNext(queueId: string): Promise<QueueEntry> {
    const next = await this.entryRepo.findOne({
      where: { queueId, status: QueueStatus.WAITING },
      order: { position: 'ASC' },
    });
    if (!next) throw new NotFoundException('No more customers in queue');

    next.status = QueueStatus.IN_PROGRESS;
    next.calledAt = new Date();
    return this.entryRepo.save(next);
  }

  async complete(entryId: string): Promise<QueueEntry> {
    const entry = await this.entryRepo.findOne({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Queue entry not found');
    entry.status = QueueStatus.COMPLETED;
    entry.servedAt = new Date();
    return this.entryRepo.save(entry);
  }

  async cancel(entryId: string, userId: string): Promise<void> {
    const entry = await this.entryRepo.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new NotFoundException('Queue entry not found');
    if (entry.status !== QueueStatus.WAITING) {
      throw new BadRequestException('Can only cancel while waiting');
    }
    entry.status = QueueStatus.CANCELLED;
    await this.entryRepo.save(entry);
  }
}
