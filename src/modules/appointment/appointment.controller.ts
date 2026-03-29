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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({ summary: 'Book an appointment' })
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.appointmentService.create(dto, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my appointments' })
  findMine(
    @CurrentUser('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.appointmentService.findForUser(userId, pagination);
  }

  @Get('salon/:salonId')
  @Roles(Role.SALON_OWNER, Role.STAFF, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all appointments for a salon' })
  findForSalon(
    @Param('salonId', ParseUUIDPipe) salonId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.appointmentService.findForSalon(salonId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SALON_OWNER, Role.STAFF, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update appointment (staff/owner)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(id, dto);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel my appointment' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.appointmentService.cancel(id, userId);
  }
}
