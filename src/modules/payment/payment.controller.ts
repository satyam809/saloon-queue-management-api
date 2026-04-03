import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiCreatedWrapped,
  ApiOkArrayWrapped,
  ApiOkWrapped,
  ApiPaginatedResponse,
} from '@common/swagger/decorators';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmOnlinePaymentDto } from './dto/confirm-online-payment.dto';
import { FailPaymentDto } from './dto/fail-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentResponseDto, PaymentRefundResponseDto } from './dto/payment-response.dto';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ─── List payments ────────────────────────────────────────────────────────

  /**
   * GET /payments
   * Role-scoped visibility:
   *   SUPER_ADMIN      → all payments (optionally filtered by salonId / customerId)
   *   SALON_OWNER/STAFF → must pass ?salonId= — their salon only
   *   CUSTOMER         → their own payments only
   */
  @Get()
  @RequirePermissions(Permission.PAYMENT_READ_OWN)
  @ApiOperation({
    summary: 'List payments',
    description:
      'Results are role-scoped. ' +
      'SALON_OWNER / STAFF must supply ?salonId=. ' +
      'Customers see only their own payments. ' +
      'Supports ?status=, ?paymentMethod=, ?from=, ?to=, ?sortBy=, ?page=, ?limit=',
  })
  @ApiPaginatedResponse(PaymentResponseDto)
  @ApiAuthErrors()
  findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.paymentService.findAll(query, requester);
  }

  // ─── Get single payment ───────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions(Permission.PAYMENT_READ_OWN)
  @ApiOperation({
    summary: 'Get payment details (includes refund history)',
    description: 'Customers can only retrieve their own payments.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.findOne(id, requester);
  }

  // ─── Create payment ───────────────────────────────────────────────────────

  /**
   * POST /payments
   * Staff creates a PENDING payment for a queue entry or appointment.
   * For offline payments, call PATCH /payments/:id/confirm-offline after collection.
   * For online payments, supply transactionId from the gateway intent at creation,
   * then call PATCH /payments/:id/confirm-online when the webhook arrives.
   */
  @Post()
  @RequirePermissions(Permission.PAYMENT_READ_SALON)
  @ApiOperation({
    summary: 'Create a payment record (PENDING)',
    description:
      'Creates a PENDING payment linked to a queue entry or appointment. ' +
      'For offline (cash/POS): confirm via PATCH .../confirm-offline. ' +
      'For online (gateway): supply transactionId, confirm via PATCH .../confirm-online. ' +
      'Idempotent on transactionId — duplicate gateway intents return the existing record.',
  })
  @ApiCreatedWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.create(dto, requester);
  }

  // ─── Offline confirmation ─────────────────────────────────────────────────

  /**
   * PATCH /payments/:id/confirm-offline
   * Staff marks a cash or POS terminal payment as collected.
   * PENDING → COMPLETED. Only valid for provider=MANUAL payments.
   */
  @Patch(':id/confirm-offline')
  @RequirePermissions(Permission.PAYMENT_READ_SALON)
  @ApiOperation({
    summary: 'Confirm an offline (cash / POS) payment — PENDING → COMPLETED',
    description:
      'Valid only for provider=MANUAL payments. ' +
      'Uses a conditional UPDATE (WHERE status=pending) to prevent double-confirmation.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  confirmOffline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.confirmOffline(id, requester);
  }

  // ─── Online confirmation ──────────────────────────────────────────────────

  /**
   * PATCH /payments/:id/confirm-online
   * Called when the payment gateway webhook confirms a successful capture.
   * PENDING → COMPLETED. Stores the gateway transactionId and raw response.
   * Idempotent — calling twice with the same transactionId is safe.
   */
  @Patch(':id/confirm-online')
  @RequirePermissions(Permission.PAYMENT_READ_SALON)
  @ApiOperation({
    summary: 'Confirm an online payment from gateway webhook — PENDING → COMPLETED',
    description:
      'Idempotent: a second call on an already-COMPLETED payment returns the ' +
      'existing record without error. ' +
      'Stores raw gatewayResponse for reconciliation.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  confirmOnline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOnlinePaymentDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.confirmOnline(id, dto, requester);
  }

  // ─── Mark failed ──────────────────────────────────────────────────────────

  /**
   * PATCH /payments/:id/fail
   * Gateway reports a declined or timed-out payment.
   * PENDING → FAILED. Idempotent on already-FAILED payments.
   */
  @Patch(':id/fail')
  @RequirePermissions(Permission.PAYMENT_READ_SALON)
  @ApiOperation({
    summary: 'Mark a payment as failed (gateway decline / timeout) — PENDING → FAILED',
    description: 'Idempotent on already-FAILED payments. Stores failure reason and gateway payload.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  markFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailPaymentDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.markFailed(id, dto, requester);
  }

  // ─── Cancel payment ───────────────────────────────────────────────────────

  /**
   * PATCH /payments/:id/cancel
   * Voids a PENDING payment before capture.
   */
  @Patch(':id/cancel')
  @RequirePermissions(Permission.PAYMENT_READ_SALON)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending payment — PENDING → CANCELLED',
    description: 'Only PENDING payments can be cancelled. Terminal status payments are immutable.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkWrapped(PaymentResponseDto)
  @ApiCommonErrors()
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.cancel(id, requester);
  }

  // ─── Issue refund ─────────────────────────────────────────────────────────

  /**
   * POST /payments/:id/refunds
   * Issues a partial or full refund on a COMPLETED or PARTIALLY_REFUNDED payment.
   *
   * Concurrency safety: the entire operation runs inside a SELECT ... FOR UPDATE
   * transaction. Two simultaneous refund requests will serialize — the second
   * sees the already-updated refundedAmount and will fail if the balance is
   * exhausted.
   */
  @Post(':id/refunds')
  @RequirePermissions(Permission.PAYMENT_REFUND)
  @ApiOperation({
    summary: 'Issue a partial or full refund',
    description:
      'COMPLETED or PARTIALLY_REFUNDED payments only. ' +
      'Partial refunds are supported — call multiple times until the full amount is refunded. ' +
      'Concurrent refund requests are serialized via SELECT FOR UPDATE.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiCreatedWrapped(PaymentRefundResponseDto)
  @ApiCommonErrors()
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentRefundResponseDto> {
    return this.paymentService.refund(id, dto, requester);
  }

  // ─── List refunds ─────────────────────────────────────────────────────────

  @Get(':id/refunds')
  @RequirePermissions(Permission.PAYMENT_READ_OWN)
  @ApiOperation({
    summary: 'List all refunds for a payment',
    description: 'Returns refund events in reverse chronological order.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkArrayWrapped(PaymentRefundResponseDto)
  @ApiCommonErrors()
  findRefunds(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<PaymentRefundResponseDto[]> {
    return this.paymentService.findRefunds(id, requester);
  }
}
