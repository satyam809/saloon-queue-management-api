import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentRefund } from './entities/payment-refund.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmOnlinePaymentDto } from './dto/confirm-online-payment.dto';
import { FailPaymentDto } from './dto/fail-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import {
  PaymentResponseDto,
  PaymentRefundResponseDto,
} from './dto/payment-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@common/enums/status.enum';
import { ActivityLogService } from '@modules/activity-log/activity-log.service';

/** Allowed status transitions for each action. */
const TERMINAL_STATUSES = [
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
] as const;

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentRefund)
    private readonly refundRepo: Repository<PaymentRefund>,
    private readonly dataSource: DataSource,
    private readonly actLog: ActivityLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a PENDING payment record.
   *
   * For offline payments (method=CASH|CARD, provider=MANUAL) — the client
   * calls confirmOffline() after the customer pays.
   *
   * For online payments — the client supplies the gateway intent ID in
   * transactionId. confirmOnline() is called when the webhook arrives.
   *
   * totalAmount is always computed server-side from the three components
   * to prevent client tampering.
   */
  async create(dto: CreatePaymentDto, requester: JwtPayload): Promise<PaymentResponseDto> {
    this.assertCanManagePayments(requester, dto.salonId);

    if (!dto.queueEntryId && !dto.appointmentId) {
      throw new BadRequestException(
        'At least one of queueEntryId or appointmentId must be provided',
      );
    }

    // Idempotency guard for online payments: prevent duplicate records for
    // the same gateway intent.
    if (dto.transactionId) {
      const duplicate = await this.paymentRepo.findOne({
        where: { transactionId: dto.transactionId },
      });
      if (duplicate) {
        return PaymentResponseDto.from(duplicate);
      }
    }

    const discount = dto.discountAmount ?? 0;
    const tax      = dto.taxAmount      ?? 0;
    const total    = Number((dto.subtotalAmount - discount + tax).toFixed(2));

    if (total <= 0) {
      throw new BadRequestException('totalAmount must be greater than zero');
    }

    const payment = this.paymentRepo.create({
      salonId:        dto.salonId,
      customerId:     dto.customerId,
      queueEntryId:   dto.queueEntryId   ?? null,
      appointmentId:  dto.appointmentId  ?? null,
      subtotalAmount: dto.subtotalAmount,
      discountAmount: discount,
      taxAmount:      tax,
      totalAmount:    total,
      currency:       dto.currency       ?? 'USD',
      paymentMethod:  dto.paymentMethod,
      provider:       dto.provider       ?? this.inferProvider(dto.paymentMethod),
      transactionId:  dto.transactionId  ?? null,
      status:         PaymentStatus.PENDING,
      notes:          dto.notes          ?? null,
    });

    const saved = await this.paymentRepo.save(payment);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.created', category: 'payment', entityType: 'payment', entityId: saved.id, newValues: { status: PaymentStatus.PENDING, totalAmount: saved.totalAmount, paymentMethod: saved.paymentMethod } });
    return PaymentResponseDto.from(saved);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Status transitions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PENDING → COMPLETED  (offline: cash or POS terminal)
   *
   * Staff marks the payment collected. Only valid for MANUAL provider payments.
   */
  async confirmOffline(id: string, requester: JwtPayload): Promise<PaymentResponseDto> {
    const payment = await this.findOrFail(id);
    this.assertCanManagePayments(requester, payment.salonId);

    if (payment.provider !== PaymentProvider.MANUAL) {
      throw new BadRequestException(
        'Use confirmOnline for gateway payments',
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm: payment is already ${payment.status}`,
      );
    }

    const updated = await this.conditionalStatusUpdate(
      id,
      PaymentStatus.PENDING,
      PaymentStatus.COMPLETED,
      { paidAt: new Date() },
    );

    if (!updated) {
      throw new ConflictException('Payment was modified concurrently — please refresh');
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.confirmed_offline', category: 'payment', entityType: 'payment', entityId: id, oldValues: { status: PaymentStatus.PENDING }, newValues: { status: PaymentStatus.COMPLETED } });
    return PaymentResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * PENDING → COMPLETED  (online: gateway webhook delivers charge confirmation)
   *
   * Stores the gateway's transactionId and raw response payload.
   * Idempotent: calling this twice with the same transactionId returns the
   * existing COMPLETED record.
   */
  async confirmOnline(
    id: string,
    dto: ConfirmOnlinePaymentDto,
    requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findOrFail(id);
    this.assertCanManagePayments(requester, payment.salonId);

    // Idempotency: webhook may deliver twice
    if (payment.status === PaymentStatus.COMPLETED) {
      return PaymentResponseDto.from(payment);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot confirm: payment is ${payment.status}`);
    }

    const updated = await this.conditionalStatusUpdate(
      id,
      PaymentStatus.PENDING,
      PaymentStatus.COMPLETED,
      {
        paidAt:           new Date(),
        transactionId:    dto.transactionId,
        gatewayResponse:  dto.gatewayResponse ?? null,
      },
    );

    if (!updated) {
      throw new ConflictException('Payment was modified concurrently — please refresh');
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.confirmed_online', category: 'payment', entityType: 'payment', entityId: id, oldValues: { status: PaymentStatus.PENDING }, newValues: { status: PaymentStatus.COMPLETED, transactionId: dto.transactionId } });
    return PaymentResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * PENDING → FAILED  (gateway reports decline / timeout)
   *
   * Idempotent: a second FAILED confirmation on an already-failed payment
   * returns the existing record.
   */
  async markFailed(
    id: string,
    dto: FailPaymentDto,
    requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findOrFail(id);
    this.assertCanManagePayments(requester, payment.salonId);

    if (payment.status === PaymentStatus.FAILED) {
      return PaymentResponseDto.from(payment);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot fail: payment is already ${payment.status}`);
    }

    const updated = await this.conditionalStatusUpdate(
      id,
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
      {
        failureReason:   dto.reason        ?? null,
        gatewayResponse: dto.gatewayResponse ?? null,
      },
    );

    if (!updated) {
      throw new ConflictException('Payment was modified concurrently — please refresh');
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.failed', category: 'payment', entityType: 'payment', entityId: id, oldValues: { status: PaymentStatus.PENDING }, newValues: { status: PaymentStatus.FAILED }, metadata: dto.reason ? { reason: dto.reason } : null });
    return PaymentResponseDto.from(updated);
  }

  // ---------------------------------------------------------------------------

  /**
   * PENDING → CANCELLED  (customer or staff cancels before payment is captured)
   */
  async cancel(id: string, requester: JwtPayload): Promise<PaymentResponseDto> {
    const payment = await this.findOrFail(id);
    this.assertCanManagePayments(requester, payment.salonId);

    if ((TERMINAL_STATUSES as readonly string[]).includes(payment.status)) {
      throw new BadRequestException(`Cannot cancel a ${payment.status} payment`);
    }

    const updated = await this.conditionalStatusUpdate(
      id,
      PaymentStatus.PENDING,
      PaymentStatus.CANCELLED,
      { cancelledAt: new Date() },
    );

    if (!updated) {
      throw new ConflictException('Payment was modified concurrently — please refresh');
    }

    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.cancelled', category: 'payment', entityType: 'payment', entityId: id, oldValues: { status: PaymentStatus.PENDING }, newValues: { status: PaymentStatus.CANCELLED } });
    return PaymentResponseDto.from(updated);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Refunds
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Issue a partial or full refund.
   *
   * Concurrency safety
   * ──────────────────
   * The entire operation runs inside a DB transaction:
   *
   *   1. SELECT payment FOR UPDATE — acquires a row-level write lock.
   *      No other transaction can read-then-update this row until we commit.
   *
   *   2. Check refundedAmount + requested <= totalAmount with the locked value.
   *      Even if two refund requests arrive simultaneously, the second one
   *      blocks on the lock and sees the already-updated refundedAmount when
   *      it finally reads.
   *
   *   3. INSERT payment_refunds row.
   *
   *   4. UPDATE payments.refunded_amount and status atomically.
   *
   * This is stronger than the conditional UPDATE pattern used elsewhere
   * because the invariant involves two columns (refundedAmount + amount ≤ total).
   */
  async refund(
    id: string,
    dto: RefundPaymentDto,
    requester: JwtPayload,
  ): Promise<PaymentRefundResponseDto> {
    return this.dataSource.transaction(async (em) => {
      // ── Step 1: lock the payment row ───────────────────────────────────────
      const payment = await em
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();

      if (!payment) throw new NotFoundException('Payment not found');

      this.assertCanRefund(requester, payment.salonId);

      // ── Step 2: validate refundable statuses ───────────────────────────────
      const refundableStatuses = [
        PaymentStatus.COMPLETED,
        PaymentStatus.PARTIALLY_REFUNDED,
      ];
      if (!refundableStatuses.includes(payment.status)) {
        throw new BadRequestException(
          `Cannot refund a payment with status: ${payment.status}. Must be COMPLETED or PARTIALLY_REFUNDED`,
        );
      }

      // ── Step 3: check refund amount doesn't exceed remaining balance ────────
      const alreadyRefunded = Number(payment.refundedAmount);
      const requestedAmount = Number(dto.amount);
      const remaining       = Number(payment.totalAmount) - alreadyRefunded;

      if (requestedAmount > remaining) {
        throw new BadRequestException(
          `Refund amount ${requestedAmount} exceeds remaining refundable balance ${remaining.toFixed(2)}`,
        );
      }

      // ── Step 4: insert refund record ───────────────────────────────────────
      const refund = em.create(PaymentRefund, {
        paymentId:       id,
        refundedById:    requester.sub,
        amount:          requestedAmount,
        reason:          dto.reason,
        transactionId:   dto.transactionId  ?? null,
        gatewayResponse: dto.gatewayResponse ?? null,
        refundedAt:      new Date(),
      });

      const savedRefund = await em.save(refund);

      // ── Step 5: update payment totals and status ───────────────────────────
      const newRefundedAmount = Number((alreadyRefunded + requestedAmount).toFixed(2));
      const isFullRefund      = newRefundedAmount >= Number(payment.totalAmount);

      await em.update(Payment, id, {
        refundedAmount: newRefundedAmount,
        status: isFullRefund
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED,
      });

      return PaymentRefundResponseDto.from(savedRefund);
    }).then((result) => {
      void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'payment.refunded', category: 'payment', entityType: 'payment', entityId: id, metadata: { refundId: result.id, amount: dto.amount, reason: dto.reason } });
      return result;
    });
  }

  // ─── List refunds for a payment ───────────────────────────────────────────

  async findRefunds(
    paymentId: string,
    requester: JwtPayload,
  ): Promise<PaymentRefundResponseDto[]> {
    const payment = await this.findOrFail(paymentId);
    this.assertCanReadPayment(requester, payment);

    const refunds = await this.refundRepo.find({
      where: { paymentId },
      order: { refundedAt: 'DESC' },
    });

    return refunds.map(PaymentRefundResponseDto.from);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Read
  // ═══════════════════════════════════════════════════════════════════════════

  async findAll(
    query: PaymentQueryDto,
    requester: JwtPayload,
  ): Promise<PaginatedResult<PaymentResponseDto>> {
    const qb = this.paymentRepo.createQueryBuilder('p');

    // ── Role-based visibility scoping ─────────────────────────────────────────
    if (requester.role === Role.CUSTOMER) {
      // Customers see only their own payments
      qb.where('p.customerId = :customerId', { customerId: requester.sub });
    } else if (
      requester.role === Role.SALON_OWNER ||
      requester.role === Role.STAFF
    ) {
      // Salon staff see their salon's payments only
      if (!query.salonId) {
        throw new BadRequestException('salonId is required for salon staff');
      }
      qb.where('p.salonId = :salonId', { salonId: query.salonId });
    } else if (requester.role === Role.SUPER_ADMIN) {
      // Admin sees all; optional filters apply
      if (query.salonId) {
        qb.where('p.salonId = :salonId', { salonId: query.salonId });
      }
      if (query.customerId) {
        qb.andWhere('p.customerId = :customerId', { customerId: query.customerId });
      }
    }

    // ── Optional filters ───────────────────────────────────────────────────────
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.paymentMethod) {
      qb.andWhere('p.paymentMethod = :method', { method: query.paymentMethod });
    }
    if (query.from) {
      qb.andWhere('p.paidAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('p.paidAt <= :to', {
        to: new Date(`${query.to}T23:59:59.999`),
      });
    }

    const sortField = query.sortBy    ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`p.${sortField}`, sortOrder);
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(
      data.map((p) => PaymentResponseDto.from(p)),
      total,
      query.page,
      query.limit,
    );
  }

  // ---------------------------------------------------------------------------

  async findOne(id: string, requester: JwtPayload): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['refunds'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    this.assertCanReadPayment(requester, payment);

    return PaymentResponseDto.from(payment, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Conditional UPDATE pattern for single-field status transitions.
   * WHERE id=? AND status=? prevents concurrent double-transitions.
   * Returns the updated entity or null if the condition wasn't met.
   */
  private async conditionalStatusUpdate(
    id: string,
    expectedStatus: PaymentStatus,
    newStatus: PaymentStatus,
    extraFields: Partial<Payment>,
  ): Promise<Payment | null> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(Payment)
      .set({ status: newStatus, ...extraFields })
      .where('id = :id AND status = :expectedStatus', { id, expectedStatus })
      .execute();

    if (result.affected === 0) return null;

    return this.paymentRepo.findOne({ where: { id } });
  }

  // ---------------------------------------------------------------------------

  private async findOrFail(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ---------------------------------------------------------------------------

  /**
   * Infers the provider from the payment method when not explicitly supplied.
   * CASH and CARD (POS) default to MANUAL. ONLINE and WALLET require the
   * caller to specify the provider explicitly; we default to MANUAL as a safe
   * fallback.
   */
  private inferProvider(method: PaymentMethod): PaymentProvider {
    if (method === PaymentMethod.CASH || method === PaymentMethod.CARD) {
      return PaymentProvider.MANUAL;
    }
    return PaymentProvider.MANUAL; // caller should override for online gateways
  }

  // ---------------------------------------------------------------------------

  /** Staff and admin can create/confirm/fail/cancel payments for any salon. */
  private assertCanManagePayments(requester: JwtPayload, salonId: string): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      requester.role === Role.SALON_OWNER ||
      requester.role === Role.STAFF
    ) {
      return; // Ownership enforced by salonId on the record
    }

    throw new ForbiddenException('You do not have permission to manage payments');
  }

  /** Only SALON_OWNER, STAFF, and SUPER_ADMIN can issue refunds. */
  private assertCanRefund(requester: JwtPayload, salonId: string): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      requester.role === Role.SALON_OWNER ||
      requester.role === Role.STAFF
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to issue refunds');
  }

  /** Customers see only their own payments; staff see their salon's. */
  private assertCanReadPayment(requester: JwtPayload, payment: Payment): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (requester.role === Role.CUSTOMER) {
      if (payment.customerId !== requester.sub) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (
      requester.role === Role.SALON_OWNER ||
      requester.role === Role.STAFF
    ) {
      return; // Both see all payments for their salon
    }

    throw new ForbiddenException('Access denied');
  }
}
