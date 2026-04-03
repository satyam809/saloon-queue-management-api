import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { ActivityLogResponseDto } from './dto/activity-log-response.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { paginate } from '@shared/utils/pagination.util';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly repo: Repository<ActivityLog>,
  ) {}

  /**
   * Fire-and-forget — callers should use `void this.actLog.log(...)`.
   * Errors are swallowed internally so a log failure never breaks the main operation.
   */
  async log(dto: CreateActivityLogDto): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          userId:     dto.userId,
          actorRole:  dto.actorRole,
          action:     dto.action,
          category:   dto.category,
          entityType: dto.entityType,
          entityId:   dto.entityId,
          oldValues:  dto.oldValues   ?? null,
          newValues:  dto.newValues   ?? null,
          metadata:   dto.metadata    ?? null,
          ipAddress:  dto.ipAddress   ?? null,
          userAgent:  dto.userAgent   ?? null,
        }),
      );
    } catch (err) {
      this.logger.error('Failed to write activity log', err);
    }
  }

  /**
   * Paginated list of logs with optional filters.
   * Pass `scopeUserId` to restrict results to a single user (for :read:own endpoints).
   */
  async findAll(
    query: ActivityLogQueryDto,
    scopeUserId?: string,
  ): Promise<PaginatedResult<ActivityLogResponseDto>> {
    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    // Scope — restrict to own logs when called from /activity-logs/me
    if (scopeUserId) {
      qb.andWhere('log.userId = :scopeUserId', { scopeUserId });
    } else if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }

    if (query.actorRole)  qb.andWhere('log.actorRole  = :actorRole',  { actorRole:  query.actorRole });
    if (query.action)     qb.andWhere('log.action      LIKE :action',  { action:     `%${query.action}%` });
    if (query.category)   qb.andWhere('log.category    = :category',   { category:   query.category });
    if (query.entityType) qb.andWhere('log.entityType  = :entityType', { entityType: query.entityType });
    if (query.entityId)   qb.andWhere('log.entityId    = :entityId',   { entityId:   query.entityId });

    if (query.fromDate) {
      qb.andWhere('log.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('log.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    const [data, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();

    return paginate(data.map(ActivityLogResponseDto.from), total, query.page, query.limit);
  }

  /**
   * Full audit trail for a single entity record (e.g. all transitions of one queue entry).
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<ActivityLogResponseDto>> {
    const [data, total] = await this.repo
      .createQueryBuilder('log')
      .where('log.entityType = :entityType', { entityType })
      .andWhere('log.entityId = :entityId',   { entityId })
      .orderBy('log.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();

    return paginate(data.map(ActivityLogResponseDto.from), total, query.page, query.limit);
  }
}
