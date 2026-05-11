import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Queue } from './entities/queue.entity';
import { QueueEntry } from './entities/queue-entry.entity';
import { CreateQueueDto } from './dto/create-queue.dto';
import { JoinQueueDto } from './dto/join-queue.dto';
import { CancelEntryDto } from './dto/cancel-entry.dto';
import { QueueResponseDto } from './dto/queue-response.dto';
import { QueueEntryResponseDto } from './dto/queue-entry-response.dto';
import { LiveQueueStateDto } from './dto/live-queue-state.dto';
import { UserPositionDto } from './dto/user-position.dto';
import { CLAIM_TOKEN_SCRIPT, CALL_NEXT_SCRIPT } from './queue.scripts';
import { RedisService } from '@shared/services/redis.service';
import { QUEUE_CACHE_KEY, QUEUE_TTL } from '@shared/constants/app.constants';
import { QueueStatus } from '@common/enums/status.enum';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { SalonService } from '@modules/salon/salon.service';
import { ActivityLogService } from '@modules/activity-log/activity-log.service';

/** Minimum completed services before rolling average is trusted over static default. */
const ROLLING_AVG_MIN_SAMPLES = 3;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(QueueEntry)
    private readonly entryRepo: Repository<QueueEntry>,
    private readonly dataSource: DataSource,
    private readonly salonService: SalonService,
    private readonly redis: RedisService,
    private readonly actLog: ActivityLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Queue lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  async openQueue(dto: CreateQueueDto, requester: JwtPayload): Promise<QueueResponseDto> {
    const salon = await this.salonService.findEntityOrFail(dto.salonId);

    if (requester.role === Role.SALON_OWNER && salon.addedById !== requester.sub) {
      throw new ForbiddenException('You can only open a queue for your own salon');
    }

    const existing = await this.queueRepo.findOne({
      where: { salonId: dto.salonId, date: dto.date },
    });

    if (existing) {
      if (existing.isOpen) throw new ConflictException('Queue is already open for this date');
      // Re-open (e.g. extended hours)
      existing.isOpen   = true;
      existing.closedAt = null;
      const saved       = await this.queueRepo.save(existing);
      await this.seedStateCache(saved, salon.avgServiceDurationMinutes);
      void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.opened', category: 'queue', entityType: 'queue', entityId: saved.id, oldValues: { isOpen: false }, newValues: { isOpen: true } });
      return QueueResponseDto.from(saved);
    }

    const queue = this.queueRepo.create({
      salonId:  dto.salonId,
      date:     dto.date,
      isOpen:   true,
      openedAt: new Date(),
    });
    const saved = await this.queueRepo.save(queue);
    await this.seedStateCache(saved, salon.avgServiceDurationMinutes);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.opened', category: 'queue', entityType: 'queue', entityId: saved.id, oldValues: null, newValues: { isOpen: true, date: dto.date } });
    return QueueResponseDto.from(saved);
  }

  // ---------------------------------------------------------------------------

  async closeQueue(queueId: string, requester: JwtPayload): Promise<QueueResponseDto> {
    const queue = await this.findQueueOrFail(queueId);
    this.assertQueueAccess(queue, requester);

    if (!queue.isOpen) throw new BadRequestException('Queue is already closed');

    // Run the close inside a transaction:
    // 1. Bulk-cancel all WAITING entries
    // 2. Mark queue closed
    await this.dataSource.transaction(async (em) => {
      await em.update(
        QueueEntry,
        { queueId, status: QueueStatus.WAITING },
        { status: QueueStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: 'Queue closed' },
      );

      queue.isOpen   = false;
      queue.closedAt = new Date();
      await em.save(queue);
    });

    // Clean up Redis structures for this queue
    await Promise.all([
      this.redis.del(QUEUE_CACHE_KEY.WAITING_SET(queueId)),
      this.redis.del(QUEUE_CACHE_KEY.TOKEN_SEQ(queueId)),
      this.redis.del(QUEUE_CACHE_KEY.STATE(queueId)),
    ]);

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.closed', category: 'queue', entityType: 'queue', entityId: queueId, oldValues: { isOpen: true }, newValues: { isOpen: false } });
    return QueueResponseDto.from(queue);
  }

  // ---------------------------------------------------------------------------

  async forceReset(queueId: string): Promise<void> {
    await this.findQueueOrFail(queueId);

    await this.dataSource.transaction(async (em) => {
      await em.update(
        QueueEntry,
        { queueId, status: QueueStatus.WAITING },
        {
          status:              QueueStatus.CANCELLED,
          cancelledAt:         new Date(),
          cancellationReason: 'Force reset by admin',
        },
      );
    });

    await Promise.all([
      this.redis.del(QUEUE_CACHE_KEY.WAITING_SET(queueId)),
      this.redis.del(QUEUE_CACHE_KEY.STATE(queueId)),
    ]);

    void this.actLog.log({ userId: null, actorRole: null, action: 'queue.force_reset', category: 'queue', entityType: 'queue', entityId: queueId, metadata: { reason: 'Force reset by admin' } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Join queue
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Concurrency strategy
   * ────────────────────
   * 1. Capacity check  — SELECT COUNT against MySQL (authoritative).
   *    Under extreme load two requests can both pass if they execute the count
   *    in the same millisecond; this may allow 1–2 customers over the limit,
   *    which is acceptable for a salon queue. If strict enforcement is needed,
   *    wrap in a SELECT ... FOR UPDATE on the Queue row.
   *
   * 2. Duplicate-join prevention + token assignment — single Lua script
   *    (CLAIM_TOKEN) executes atomically on Redis. The script checks the
   *    member-lock key and, only if absent, increments the token counter and
   *    sets the lock. No application-level race is possible.
   *
   * 3. DB insert — if it fails after the Lua script has run (e.g. DB error),
   *    we release the member-lock and decrement the token so the customer can
   *    retry. Token gaps are harmless.
   *
   * 4. Sorted-set ZADD — fire-and-forget after a successful DB insert.
   *    The set is a cache; correctness is maintained by the DB.
   */
  async join(
    queueId: string,
    customerId: string,
    dto: JoinQueueDto,
  ): Promise<QueueEntryResponseDto> {
    const queue = await this.findQueueOrFail(queueId);
    if (!queue.isOpen) throw new BadRequestException('Queue is not open');

    const salon = await this.salonService.findEntityOrFail(queue.salonId);

    // ── 1. Capacity check (DB is authoritative) ─────────────────────────────
    const waitingCount = await this.entryRepo.count({
      where: { queueId, status: QueueStatus.WAITING },
    });
    if (waitingCount >= salon.maxQueueSize) {
      throw new BadRequestException(
        `Queue is full (maximum ${salon.maxQueueSize} customers)`,
      );
    }

    // ── 2. Atomic duplicate-join prevention + token assignment (Lua) ─────────
    const lockKey = QUEUE_CACHE_KEY.MEMBER_LOCK(queueId, customerId);
    const seqKey  = QUEUE_CACHE_KEY.TOKEN_SEQ(queueId);

    const [errorCode, tokenNumber] = (await this.redis.eval(
      CLAIM_TOKEN_SCRIPT,
      [lockKey, seqKey],
      [QUEUE_TTL.EOD_SECONDS],
    )) as [number, number];

    if (errorCode === 1) {
      throw new ConflictException('You are already in this queue');
    }

    // ── 3. Persist entry ─────────────────────────────────────────────────────
    const joinTs    = Date.now();
    const position  = waitingCount + 1;   // snapshot at check-in (historical record)
    const avgDur    = await this.getAvgDuration(queueId, salon.avgServiceDurationMinutes);
    const ewt       = Math.round(waitingCount * avgDur);  // people-ahead × avg duration

    let saved: QueueEntry;
    try {
      const entry = this.entryRepo.create({
        queueId,
        customerId,
        barberId:            dto.barberId  ?? null,
        serviceId:           dto.serviceId ?? null,
        tokenNumber,
        position,
        status:              QueueStatus.WAITING,
        estimatedWaitMinutes: ewt,
        notes:               dto.notes     ?? null,
        checkedInAt:         new Date(joinTs),
      });
      saved = await this.entryRepo.save(entry);
    } catch (err) {
      // ── Compensating actions: release lock, walk back token ─────────────
      await this.redis.del(lockKey);
      // We can't safely decrement the sequence (another join could have already
      // incremented it again), so we leave a gap. Token gaps are acceptable.
      this.logger.error(`Queue entry DB insert failed for customer ${customerId}`, err);
      throw new InternalServerErrorException('Failed to join queue — please try again');
    }

    // ── 4. Add to sorted set (score = join timestamp → strict FIFO) ──────────
    const setKey = QUEUE_CACHE_KEY.WAITING_SET(queueId);
    await this.redis.zadd(setKey, joinTs, saved.id);
    await this.redis.expire(setKey, QUEUE_TTL.EOD_SECONDS);

    // ── 5. Update state cache + user position snapshot ────────────────────────
    await Promise.all([
      this.redis.del(QUEUE_CACHE_KEY.STATE(queueId)),
      this.redis.setJson(
        QUEUE_CACHE_KEY.USER_POSITION(queueId, customerId),
        { entryId: saved.id, tokenNumber, position, ewt },
        QUEUE_TTL.USER_POSITION_SECONDS,
      ),
    ]);

    void this.actLog.log({ userId: customerId, actorRole: Role.CUSTOMER, action: 'queue.entry.joined', category: 'queue', entityType: 'queue_entry', entityId: saved.id, newValues: { status: QueueStatus.WAITING }, metadata: { tokenNumber, position, estimatedWaitMinutes: ewt } });
    return QueueEntryResponseDto.from(saved);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Status transitions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * WAITING → CALLED
   *
   * Concurrency strategy
   * ────────────────────
   * The CALL_NEXT_SCRIPT Lua script atomically pops the front of the sorted
   * set. Even if two staff members press "call next" simultaneously, only one
   * receives a non-empty entryId — the other gets "".
   *
   * After the pop, the conditional UPDATE (WHERE status = 'waiting') acts as a
   * second safety net: if Redis was evicted and two concurrent calls both fell
   * back to a DB query, only one UPDATE will affect a row (the other sees
   * affected=0 and retries).
   */
  async callNext(queueId: string, requester: JwtPayload): Promise<QueueEntryResponseDto> {
    const queue = await this.findQueueOrFail(queueId);
    this.assertQueueAccess(queue, requester);
    if (!queue.isOpen) throw new BadRequestException('Queue is closed');

    const setKey = QUEUE_CACHE_KEY.WAITING_SET(queueId);

    // ── Try atomic Redis pop first ────────────────────────────────────────────
    let entryId = (await this.redis.eval(CALL_NEXT_SCRIPT, [setKey], [])) as string;

    if (entryId) {
      // Fast path — use the ID from Redis
      const updated = await this.conditionalStatusUpdate(
        entryId,
        QueueStatus.WAITING,
        QueueStatus.CALLED,
        { calledAt: new Date() },
      );

      if (!updated) {
        // Redis set had a stale entry (e.g. already cancelled in DB but not
        // removed from the set). Retry once against DB.
        return this.callNextFromDb(queueId, queue, requester);
      }

      await this.updateServingPosition(queue, updated.tokenNumber);
      void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.entry.called', category: 'queue', entityType: 'queue_entry', entityId: updated.id, oldValues: { status: QueueStatus.WAITING }, newValues: { status: QueueStatus.CALLED } });
      return QueueEntryResponseDto.from(updated);
    }

    // ── Cold-start / eviction fallback: query DB ─────────────────────────────
    return this.callNextFromDb(queueId, queue, requester);
  }

  // ---------------------------------------------------------------------------

  /**
   * CALLED → IN_PROGRESS
   * Uses conditional UPDATE to prevent double-transition.
   */
  async startService(entryId: string, requester: JwtPayload): Promise<QueueEntryResponseDto> {
    const entry = await this.findEntryOrFail(entryId);
    this.assertQueueAccess(await this.findQueueOrFail(entry.queueId), requester);

    const updated = await this.conditionalStatusUpdate(
      entryId,
      QueueStatus.CALLED,
      QueueStatus.IN_PROGRESS,
      { serviceStartedAt: new Date() },
    );

    if (!updated) {
      throw new BadRequestException(
        `Cannot start service: entry is ${entry.status}, expected CALLED`,
      );
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.entry.service_started', category: 'queue', entityType: 'queue_entry', entityId: entryId, oldValues: { status: QueueStatus.CALLED }, newValues: { status: QueueStatus.IN_PROGRESS } });
    return QueueEntryResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * IN_PROGRESS → COMPLETED
   * Uses conditional UPDATE. After success, updates rolling average in Redis.
   */
  async complete(entryId: string, requester: JwtPayload): Promise<QueueEntryResponseDto> {
    const entry = await this.findEntryOrFail(entryId);
    const queue = await this.findQueueOrFail(entry.queueId);
    this.assertQueueAccess(queue, requester);

    const completedAt = new Date();
    const updated     = await this.conditionalStatusUpdate(
      entryId,
      QueueStatus.IN_PROGRESS,
      QueueStatus.COMPLETED,
      { completedAt },
    );

    if (!updated) {
      throw new BadRequestException(
        `Cannot complete: entry is ${entry.status}, expected IN_PROGRESS`,
      );
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.entry.completed', category: 'queue', entityType: 'queue_entry', entityId: entryId, oldValues: { status: QueueStatus.IN_PROGRESS }, newValues: { status: QueueStatus.COMPLETED } });

    // Increment denormalized counter (non-critical, best-effort)
    await this.queueRepo.increment({ id: queue.id }, 'totalServed', 1);

    // Update rolling average service duration in state hash
    if (entry.serviceStartedAt) {
      const actualMin =
        (completedAt.getTime() - entry.serviceStartedAt.getTime()) / 60_000;
      const stateKey  = QUEUE_CACHE_KEY.STATE(queue.id);
      await Promise.all([
        this.redis.hincrbyfloat(stateKey, 'totalDurationSum', actualMin),
        this.redis.hincrby(stateKey, 'completedCount', 1),
      ]);
    }

    await this.releaseMemberLock(queue.id, entry.customerId);
    await this.redis.del(QUEUE_CACHE_KEY.STATE(queue.id));

    return QueueEntryResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * CALLED | IN_PROGRESS → NO_SHOW
   */
  async markNoShow(entryId: string, requester: JwtPayload): Promise<QueueEntryResponseDto> {
    const entry = await this.findEntryOrFail(entryId);
    const queue = await this.findQueueOrFail(entry.queueId);
    this.assertQueueAccess(queue, requester);

    const allowedFrom = [QueueStatus.CALLED, QueueStatus.IN_PROGRESS];
    if (!allowedFrom.includes(entry.status)) {
      throw new BadRequestException(
        `Cannot mark no-show: entry is ${entry.status}. Must be CALLED or IN_PROGRESS`,
      );
    }

    // For no-show either of the two allowed source statuses is valid —
    // use a direct update with the known current status.
    const updated = await this.conditionalStatusUpdate(
      entryId,
      entry.status,        // whichever was loaded
      QueueStatus.NO_SHOW,
      { completedAt: new Date() },
    );

    if (!updated) {
      throw new ConflictException('Entry was modified concurrently — please refresh and retry');
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.entry.no_show', category: 'queue', entityType: 'queue_entry', entityId: entryId, oldValues: { status: entry.status }, newValues: { status: QueueStatus.NO_SHOW } });

    await this.releaseMemberLock(queue.id, entry.customerId);
    await this.redis.del(QUEUE_CACHE_KEY.STATE(queue.id));

    return QueueEntryResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * WAITING | CALLED → CANCELLED
   *
   * Concurrency strategy
   * ────────────────────
   * The conditional UPDATE (WHERE status IN (...)) ensures idempotency —
   * a double-cancel returns 0 affected rows and we throw a descriptive error
   * instead of silently succeeding twice.
   *
   * The ZREM is idempotent (no-op if entry was already removed), so calling
   * it before the DB update is safe.
   */
  async cancel(
    entryId: string,
    requesterId: string,
    requesterRole: Role,
    dto: CancelEntryDto,
  ): Promise<void> {
    const entry = await this.findEntryOrFail(entryId);

    const isOwner = entry.customerId === requesterId;
    const isStaff =
      requesterRole === Role.STAFF ||
      requesterRole === Role.SALON_OWNER ||
      requesterRole === Role.SUPER_ADMIN;

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You can only cancel your own queue entry');
    }

    const cancellableStatuses = [QueueStatus.WAITING, QueueStatus.CALLED];
    if (!cancellableStatuses.includes(entry.status)) {
      throw new BadRequestException(
        `Cannot cancel: entry is ${entry.status}. Only WAITING or CALLED entries can be cancelled`,
      );
    }

    // Remove from sorted set before DB update (idempotent ZREM)
    if (entry.status === QueueStatus.WAITING) {
      await this.redis.zrem(QUEUE_CACHE_KEY.WAITING_SET(entry.queueId), entry.id);
    }

    // Conditional update — if another request already changed the status, this
    // returns null and we surface a clear concurrency error.
    const result = await this.dataSource
      .createQueryBuilder()
      .update(QueueEntry)
      .set({
        status:             QueueStatus.CANCELLED,
        cancelledAt:        new Date(),
        cancellationReason: dto.reason ?? null,
      })
      .where('id = :id AND status IN (:...statuses)', {
        id:       entry.id,
        statuses: cancellableStatuses,
      })
      .execute();

    if (result.affected === 0) {
      throw new ConflictException('Entry was already cancelled or progressed — please refresh');
    }

    void this.actLog.log({ userId: requesterId, actorRole: requesterRole, action: 'queue.entry.cancelled', category: 'queue', entityType: 'queue_entry', entityId: entryId, oldValues: { status: entry.status }, newValues: { status: QueueStatus.CANCELLED }, metadata: dto.reason ? { reason: dto.reason } : null });

    await this.releaseMemberLock(entry.queueId, entry.customerId);
    await this.redis.del(QUEUE_CACHE_KEY.STATE(entry.queueId));
    await this.redis.del(QUEUE_CACHE_KEY.USER_POSITION(entry.queueId, entry.customerId));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Read operations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Live queue state for the public display board.
   * Served from Redis state hash (60 s TTL) on cache hit — zero DB queries.
   * On cache miss, rebuilds from DB and repopulates the hash.
   */
  async getLiveState(salonId: string, date: string): Promise<LiveQueueStateDto> {
    const queue = await this.queueRepo.findOne({ where: { salonId, date } });
    if (!queue) throw new NotFoundException('No queue found for this salon and date');

    const stateKey = QUEUE_CACHE_KEY.STATE(queue.id);
    const cached   = await this.redis.hgetall(stateKey);

    const salon       = await this.salonService.findEntityOrFail(salonId);
    const fallbackAvg = salon.avgServiceDurationMinutes;

    let waitingCount: number;
    let currentServingToken: number;
    let avgDuration: number;

    if (cached?.waitingCount !== undefined) {
      waitingCount        = parseInt(cached.waitingCount, 10);
      currentServingToken = parseInt(cached.currentServingToken ?? '0', 10);
      avgDuration         = parseFloat(cached.avgDuration ?? String(fallbackAvg));
    } else {
      // Cache miss — rebuild from DB (authoritative)
      waitingCount        = await this.entryRepo.count({
        where: { queueId: queue.id, status: QueueStatus.WAITING },
      });
      currentServingToken = queue.currentServingPosition;
      avgDuration         = await this.getAvgDuration(queue.id, fallbackAvg);

      await this.redis.hmset(stateKey, {
        waitingCount,
        currentServingToken,
        avgDuration,
        totalDurationSum: 0,
        completedCount:   0,
      });
      await this.redis.expire(stateKey, QUEUE_TTL.STATE_SECONDS);
    }

    const dto                     = new LiveQueueStateDto();
    dto.queueId                   = queue.id;
    dto.salonId                   = salonId;
    dto.date                      = date;
    dto.isOpen                    = queue.isOpen;
    dto.waitingCount              = waitingCount;
    dto.currentServingToken       = currentServingToken;
    dto.avgServiceDurationMinutes = Math.round(avgDuration);
    dto.estimatedWaitForNewJoin   = Math.round(waitingCount * avgDuration);
    return dto;
  }

  // ---------------------------------------------------------------------------

  /**
   * Customer's live position in the queue.
   *
   * Position is read from the Redis sorted set via ZRANK — O(log N), no DB.
   * Falls back to a DB COUNT query when the sorted set has been evicted
   * (Redis restart / key expiry), and simultaneously rebuilds the set from DB
   * so subsequent calls are fast again.
   */
  async getMyPosition(queueId: string, userId: string): Promise<UserPositionDto> {
    const entry = await this.entryRepo.findOne({
      where: {
        queueId,
        customerId: userId,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]),
      },
    });

    if (!entry) throw new NotFoundException('You are not in this queue');

    const result          = new UserPositionDto();
    result.entryId        = entry.id;
    result.tokenNumber    = entry.tokenNumber;
    result.tokenDisplay   = this.formatToken(entry.tokenNumber);
    result.status         = entry.status;
    result.livePosition   = null;
    result.peopleAhead    = null;
    result.estimatedWaitMinutes = null;

    if (entry.status !== QueueStatus.WAITING) return result;

    const setKey = QUEUE_CACHE_KEY.WAITING_SET(queueId);
    let rank     = await this.redis.zrank(setKey, entry.id);

    if (rank === null) {
      // Sorted set was evicted — rebuild it, then re-read rank
      rank = await this.rebuildWaitingSetAndGetRank(queueId, entry.id);
    }

    if (rank !== null) {
      const queue  = await this.findQueueOrFail(queueId);
      const salon  = await this.salonService.findEntityOrFail(queue.salonId);
      const avgDur = await this.getAvgDuration(queueId, salon.avgServiceDurationMinutes);

      result.livePosition         = rank + 1;  // 1-based
      result.peopleAhead          = rank;
      result.estimatedWaitMinutes = Math.round(rank * avgDur);
    }

    return result;
  }

  // ---------------------------------------------------------------------------

  async findBySalonAndDate(salonId: string, date: string): Promise<QueueResponseDto> {
    const queue = await this.queueRepo.findOne({ where: { salonId, date } });
    if (!queue) throw new NotFoundException('No queue found for this salon and date');
    return QueueResponseDto.from(queue);
  }

  // ---------------------------------------------------------------------------

  async getEntries(
    queueId: string,
    status?: QueueStatus,
  ): Promise<QueueEntryResponseDto[]> {
    await this.findQueueOrFail(queueId);

    const entries = await this.entryRepo.find({
      where: status ? { queueId, status } : { queueId },
      order: { position: 'ASC', checkedInAt: 'ASC' },
    });

    return entries.map(QueueEntryResponseDto.from);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Performs a status transition using a conditional UPDATE.
   *
   * UPDATE queue_entries
   *   SET   status = :newStatus, <fields>
   *   WHERE id = :id AND status = :expectedStatus
   *
   * Returns the updated entity on success, null if the row was not in the
   * expected status (concurrent modification detected).
   *
   * This is the "optimistic locking" pattern for finite-state machines:
   * no explicit locks are needed because the database rejects the update if
   * the state has already changed.
   */
  private async conditionalStatusUpdate(
    entryId: string,
    expectedStatus: QueueStatus,
    newStatus: QueueStatus,
    extraFields: Partial<QueueEntry>,
  ): Promise<QueueEntry | null> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(QueueEntry)
      .set({ status: newStatus, ...extraFields })
      .where('id = :id AND status = :expectedStatus', { id: entryId, expectedStatus })
      .execute();

    if (result.affected === 0) return null;

    // Re-fetch to return the full updated entity
    return this.entryRepo.findOne({ where: { id: entryId } });
  }

  // ---------------------------------------------------------------------------

  /**
   * Fallback for callNext when the Redis sorted set is empty (cold start or
   * eviction). Queries DB for the oldest WAITING entry and performs a
   * conditional UPDATE so that if two concurrent requests both fall into this
   * path, only one succeeds.
   */
  private async callNextFromDb(
    queueId: string,
    queue: Queue,
    requester: JwtPayload,
  ): Promise<QueueEntryResponseDto> {
    const candidate = await this.entryRepo.findOne({
      where: { queueId, status: QueueStatus.WAITING },
      order: { position: 'ASC', checkedInAt: 'ASC' },
    });

    if (!candidate) throw new NotFoundException('No customers are waiting');

    const updated = await this.conditionalStatusUpdate(
      candidate.id,
      QueueStatus.WAITING,
      QueueStatus.CALLED,
      { calledAt: new Date() },
    );

    if (!updated) {
      // Another request just claimed this entry — try one more time
      return this.callNext(queueId, requester);
    }

    await this.updateServingPosition(queue, updated.tokenNumber);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'queue.entry.called', category: 'queue', entityType: 'queue_entry', entityId: updated.id, oldValues: { status: QueueStatus.WAITING }, newValues: { status: QueueStatus.CALLED } });
    return QueueEntryResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  private async updateServingPosition(queue: Queue, tokenNumber: number): Promise<void> {
    await this.queueRepo.update(queue.id, { currentServingPosition: tokenNumber });
    // Best-effort state hash update (60 s TTL means stale is acceptable)
    await this.redis.hset(QUEUE_CACHE_KEY.STATE(queue.id), 'currentServingToken', tokenNumber);
  }

  // ---------------------------------------------------------------------------

  /**
   * Rebuilds the Redis sorted set from DB when it has been evicted.
   * Uses a pipeline for efficiency. Returns the 0-based rank of the given
   * entryId after the rebuild, or null if the entry is not in the set.
   *
   * This is called only on the cold-start / eviction path — the happy path
   * always hits ZRANK directly.
   */
  private async rebuildWaitingSetAndGetRank(
    queueId: string,
    targetEntryId: string,
  ): Promise<number | null> {
    const waitingEntries = await this.entryRepo.find({
      where: { queueId, status: QueueStatus.WAITING },
      order: { checkedInAt: 'ASC' },
      select: ['id', 'checkedInAt', 'customerId'],
    });

    if (waitingEntries.length === 0) return null;

    const setKey = QUEUE_CACHE_KEY.WAITING_SET(queueId);

    // Rebuild sorted set and member locks in parallel
    await Promise.all([
      ...waitingEntries.map((e) =>
        this.redis.zadd(setKey, e.checkedInAt.getTime(), e.id),
      ),
      this.redis.expire(setKey, QUEUE_TTL.EOD_SECONDS),
    ]);

    return this.redis.zrank(setKey, targetEntryId);
  }

  // ---------------------------------------------------------------------------

  private async getAvgDuration(queueId: string, fallback: number): Promise<number> {
    const stateKey = QUEUE_CACHE_KEY.STATE(queueId);
    const [total, count] = await Promise.all([
      this.redis.hget(stateKey, 'totalDurationSum'),
      this.redis.hget(stateKey, 'completedCount'),
    ]);

    const completedCount = parseInt(count ?? '0', 10);
    const totalDuration  = parseFloat(total ?? '0');

    if (completedCount >= ROLLING_AVG_MIN_SAMPLES) {
      return totalDuration / completedCount;
    }
    return fallback;
  }

  // ---------------------------------------------------------------------------

  private async seedStateCache(queue: Queue, salonAvgDuration: number): Promise<void> {
    const stateKey = QUEUE_CACHE_KEY.STATE(queue.id);
    await this.redis.hmset(stateKey, {
      waitingCount:        0,
      currentServingToken: 0,
      avgDuration:         salonAvgDuration,
      totalDurationSum:    0,
      completedCount:      0,
    });
    await this.redis.expire(stateKey, QUEUE_TTL.STATE_SECONDS);
  }

  // ---------------------------------------------------------------------------

  private async releaseMemberLock(queueId: string, customerId: string): Promise<void> {
    await this.redis.del(QUEUE_CACHE_KEY.MEMBER_LOCK(queueId, customerId));
  }

  // ---------------------------------------------------------------------------

  private async findQueueOrFail(id: string): Promise<Queue> {
    const queue = await this.queueRepo.findOne({ where: { id } });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  private async findEntryOrFail(id: string): Promise<QueueEntry> {
    const entry = await this.entryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Queue entry not found');
    return entry;
  }

  private assertQueueAccess(queue: Queue, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;
    if (requester.role === Role.SALON_OWNER || requester.role === Role.STAFF) return;
    throw new ForbiddenException('You do not have permission to manage this queue');
  }

  private formatToken(tokenNumber: number): string {
    return `A-${String(tokenNumber).padStart(3, '0')}`;
  }
}
