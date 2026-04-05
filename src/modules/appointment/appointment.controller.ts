import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiCreatedWrapped,
  ApiOkWrapped,
  ApiPaginatedResponse,
} from '@common/swagger/decorators';

// ─── Inline response DTO for Swagger ──────────────────────────────────────
// The appointment service returns plain entity objects for now, so we use a
// lightweight class purely to give Swagger a typed schema to render.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Lightweight Swagger schema class representing a serialised appointment.
 *
 * This class is used exclusively by the OpenAPI/Swagger documentation layer
 * to describe the shape of appointment responses. The actual service returns
 * the underlying {@link Appointment} entity directly.
 */
class AppointmentResponseDto {
  /**
   * Unique identifier of the appointment (UUID).
   *
   * @example 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   */
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  /**
   * UUID of the salon where the appointment is booked.
   *
   * @example 'b2c3d4e5-f6a7-8901-bcde-f01234567890'
   */
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' })
  salonId: string;

  /**
   * UUID of the assigned staff member, or `null` when none is assigned.
   *
   * @example 'c3d4e5f6-a7b8-9012-cdef-012345678901'
   */
  @ApiPropertyOptional({ example: 'c3d4e5f6-a7b8-9012-cdef-012345678901', nullable: true })
  staffId: string | null;

  /**
   * UUID of the customer who made the appointment.
   *
   * @example 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   */
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  customerId: string;

  /**
   * ISO 8601 timestamp for when the appointment is scheduled to begin.
   *
   * @example '2026-04-10T10:00:00.000Z'
   */
  @ApiProperty({ example: '2026-04-10T10:00:00.000Z' })
  scheduledAt: string;

  /**
   * Duration of the appointment in minutes.
   *
   * @example 30
   */
  @ApiProperty({ example: 30 })
  durationMinutes: number;

  /**
   * Human-readable label for the type of service requested, or `null`.
   *
   * @example 'Haircut'
   */
  @ApiPropertyOptional({ example: 'Haircut', nullable: true })
  serviceType: string | null;

  /**
   * Optional free-text notes or special requests, or `null`.
   *
   * @example 'Please trim the beard too.'
   */
  @ApiPropertyOptional({ example: 'Please trim the beard too.', nullable: true })
  notes: string | null;

  /**
   * Current lifecycle status of the appointment.
   *
   * @example 'SCHEDULED'
   */
  @ApiProperty({ example: 'SCHEDULED', description: 'SCHEDULED | CONFIRMED | COMPLETED | CANCELLED' })
  status: string;

  /**
   * ISO 8601 timestamp at which the appointment record was created.
   *
   * @example '2026-04-03T08:00:00.000Z'
   */
  @ApiProperty({ example: '2026-04-03T08:00:00.000Z' })
  createdAt: string;

  /**
   * ISO 8601 timestamp at which the appointment record was last updated.
   *
   * @example '2026-04-03T08:00:00.000Z'
   */
  @ApiProperty({ example: '2026-04-03T08:00:00.000Z' })
  updatedAt: string;
}

/**
 * REST controller for the `/appointments` resource.
 *
 * Exposes endpoints for booking, retrieving, updating, and cancelling
 * appointments. All routes require a valid Bearer token.
 */
@ApiTags('Appointments')
@ApiBearerAuth('bearer')
@Controller('appointments')
export class AppointmentController {
  /**
   * Injects the {@link AppointmentService} used by all route handlers.
   *
   * @param appointmentService - The service layer responsible for appointment business logic.
   */
  constructor(private readonly appointmentService: AppointmentService) {}

  // ─── Book appointment ─────────────────────────────────────────────────────

  /**
   * POST /appointments
   *
   * Books a new appointment for the currently authenticated customer.
   * The `scheduledAt` time must be in the future and must not conflict with
   * another CONFIRMED appointment for the same salon and (optionally) staff member.
   *
   * @param dto    - Payload describing the desired appointment.
   * @param userId - UUID of the authenticated customer extracted from the JWT.
   * @returns The newly created appointment wrapped in a success envelope.
   */
  @Post()
  @ApiOperation({
    summary: 'Book an appointment',
    description:
      'Creates a new appointment for the authenticated customer. ' +
      'The `scheduledAt` time must be within the salon\'s operating hours.',
  })
  @ApiCreatedWrapped(AppointmentResponseDto)
  @ApiCommonErrors()
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.appointmentService.create(dto, userId);
  }

  // ─── My appointments ──────────────────────────────────────────────────────

  /**
   * GET /appointments/my
   *
   * Returns a paginated list of appointments belonging to the authenticated
   * customer, ordered newest-first by `scheduledAt`.
   *
   * @param userId     - UUID of the authenticated customer extracted from the JWT.
   * @param pagination - Pagination parameters (`page`, `limit`).
   * @returns Paginated appointment records for the authenticated user.
   */
  @Get('my')
  @ApiOperation({
    summary: 'Get my appointments',
    description: 'Returns paginated appointments for the authenticated customer, newest first.',
  })
  @ApiQuery({ name: 'page',  required: false, example: 1,  description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Items per page (max 100)' })
  @ApiPaginatedResponse(AppointmentResponseDto)
  @ApiAuthErrors()
  findMine(
    @CurrentUser('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.appointmentService.findForUser(userId, pagination);
  }

  // ─── Salon appointments (staff/owner) ─────────────────────────────────────

  /**
   * GET /appointments/salon/:salonId
   *
   * Returns a paginated list of all appointments for the specified salon,
   * ordered ascending by `scheduledAt`. Restricted to SALON_OWNER, STAFF,
   * and SUPER_ADMIN roles.
   *
   * @param salonId    - UUID of the target salon.
   * @param pagination - Pagination parameters (`page`, `limit`).
   * @returns Paginated appointment records for the given salon.
   */
  @Get('salon/:salonId')
  @Roles(Role.SALON_OWNER, Role.STAFF, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all appointments for a salon',
    description: 'Staff, salon owner, and super admin only. Returns paginated results.',
  })
  @ApiParam({ name: 'salonId', description: 'Salon UUID' })
  @ApiQuery({ name: 'page',  required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiPaginatedResponse(AppointmentResponseDto)
  @ApiAuthErrors()
  findForSalon(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.appointmentService.findForSalon(salonId, pagination);
  }

  // ─── Single appointment ───────────────────────────────────────────────────

  /**
   * GET /appointments/:id
   *
   * Retrieves a single appointment by its UUID. Customers may only fetch
   * their own appointments; staff and owners may fetch any.
   *
   * @param id - UUID of the appointment to retrieve.
   * @returns The matching appointment wrapped in a success envelope.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get appointment by ID',
    description: 'Customers can only retrieve their own appointments.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiOkWrapped(AppointmentResponseDto)
  @ApiCommonErrors()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentService.findOne(id);
  }

  // ─── Update appointment ───────────────────────────────────────────────────

  /**
   * PATCH /appointments/:id
   *
   * Updates an existing appointment (e.g. reschedule or change notes).
   * Restricted to SALON_OWNER, STAFF, and SUPER_ADMIN roles.
   *
   * @param id  - UUID of the appointment to update.
   * @param dto - Partial payload with fields to update.
   * @returns The updated appointment wrapped in a success envelope.
   */
  @Patch(':id')
  @Roles(Role.SALON_OWNER, Role.STAFF, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update appointment (staff/owner)',
    description: 'SALON_OWNER, STAFF, and SUPER_ADMIN can reschedule or update notes.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiOkWrapped(AppointmentResponseDto)
  @ApiCommonErrors()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(id, dto);
  }

  // ─── Cancel appointment ───────────────────────────────────────────────────

  /**
   * PATCH /appointments/:id/cancel
   *
   * Allows the authenticated customer to cancel one of their own appointments.
   * Only appointments in the SCHEDULED or CONFIRMED state may be cancelled;
   * attempting to cancel a COMPLETED or already CANCELLED appointment returns
   * a 400 Bad Request.
   *
   * @param id     - UUID of the appointment to cancel.
   * @param userId - UUID of the authenticated customer extracted from the JWT.
   * @returns The cancelled appointment wrapped in a success envelope.
   */
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel my appointment',
    description:
      'Customers cancel their own appointment. ' +
      'Only SCHEDULED or CONFIRMED appointments can be cancelled.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiOkWrapped(AppointmentResponseDto)
  @ApiCommonErrors()
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.appointmentService.cancel(id, userId);
  }
}
