import {
  Body,
  Controller,
  Delete,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AssignBarberDto } from './dto/assign-barber.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  // ─── Public: browse catalog ───────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List services',
    description:
      'Public / customers see only active services. ' +
      'Owners and staff see all (including inactive). ' +
      'Supports ?salonId=, ?search=, ?category=, ?isActive=, ?sortBy=, ?page=, ?limit=',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of ServiceResponseDto' })
  findAll(
    @Query() query: ServiceQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.serviceService.findAll(query, requester);
  }

  // ─── Public: single service ───────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get service details' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceResponseDto> {
    return this.serviceService.findOne(id);
  }

  // ─── Create service ───────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.SERVICE_CREATE)
  @ApiOperation({
    summary: 'Create a service in a salon',
    description:
      'Adds a new service to the salon's catalog. ' +
      'Requires SERVICE_CREATE permission (SALON_OWNER, SUPER_ADMIN).',
  })
  @ApiResponse({ status: 201, type: ServiceResponseDto })
  create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ServiceResponseDto> {
    return this.serviceService.create(dto, requester);
  }

  // ─── Update service ───────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions(Permission.SERVICE_UPDATE)
  @ApiOperation({
    summary: 'Update a service',
    description: 'SALON_OWNER can update services in their salon. SUPER_ADMIN can update any.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ServiceResponseDto> {
    return this.serviceService.update(id, dto, requester);
  }

  // ─── Delete service ───────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions(Permission.SERVICE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a service',
    description: 'Sets deletedAt. Existing appointments referencing this service are preserved.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 204 })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.serviceService.remove(id, requester);
  }

  // ─── Barber assignment ────────────────────────────────────────────────────

  /**
   * POST /services/:id/barbers
   * Assigns a barber to a service with optional per-barber price/duration overrides.
   */
  @Post(':id/barbers')
  @RequirePermissions(Permission.SERVICE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Assign a barber to a service',
    description:
      'Creates a barber↔service link. Optionally override price and duration for this barber. ' +
      'Returns 409 if the barber is already assigned.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'Barber already assigned to this service' })
  assignBarber(
    @Param('id', ParseUUIDPipe) serviceId: string,
    @Body() dto: AssignBarberDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.serviceService.assignBarber(serviceId, dto, requester);
  }

  /**
   * DELETE /services/:id/barbers/:barberId
   * Removes the barber↔service assignment (hard delete of the pivot row).
   */
  @Delete(':id/barbers/:barberId')
  @RequirePermissions(Permission.SERVICE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a barber from a service',
    description: 'Deletes the barber↔service pivot row. Historical records are unaffected.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiParam({ name: 'barberId', description: 'Barber UUID' })
  @ApiResponse({ status: 204 })
  removeBarber(
    @Param('id', ParseUUIDPipe) serviceId: string,
    @Param('barberId', ParseUUIDPipe) barberId: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.serviceService.removeBarber(serviceId, barberId, requester);
  }

  /**
   * GET /services/:id/barbers
   * Lists all barbers assigned to a service, with their custom price/duration overrides.
   */
  @Public()
  @Get(':id/barbers')
  @ApiOperation({
    summary: 'List barbers assigned to a service',
    description: 'Returns barber↔service pivot rows including any per-barber overrides.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Array of BarberService assignment records' })
  findBarbers(@Param('id', ParseUUIDPipe) serviceId: string) {
    return this.serviceService.findBarbers(serviceId);
  }
}
