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

class AppointmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' })
  salonId: string;

  @ApiPropertyOptional({ example: 'c3d4e5f6-a7b8-9012-cdef-012345678901', nullable: true })
  staffId: string | null;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  customerId: string;

  @ApiProperty({ example: '2026-04-10T10:00:00.000Z' })
  scheduledAt: string;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiPropertyOptional({ example: 'Haircut', nullable: true })
  serviceType: string | null;

  @ApiPropertyOptional({ example: 'Please trim the beard too.', nullable: true })
  notes: string | null;

  @ApiProperty({ example: 'SCHEDULED', description: 'SCHEDULED | CONFIRMED | COMPLETED | CANCELLED' })
  status: string;

  @ApiProperty({ example: '2026-04-03T08:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-03T08:00:00.000Z' })
  updatedAt: string;
}

@ApiTags('Appointments')
@ApiBearerAuth('bearer')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // ─── Book appointment ─────────────────────────────────────────────────────

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
