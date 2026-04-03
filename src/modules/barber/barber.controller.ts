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
import { BarberService } from './barber.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { BarberQueryDto } from './dto/barber-query.dto';
import { BarberResponseDto } from './dto/barber-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@ApiTags('Barbers')
@ApiBearerAuth()
@Controller('barbers')
export class BarberController {
  constructor(private readonly barberService: BarberService) {}

  // ─── Public: browse barbers ───────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List barbers',
    description:
      'Public callers see only ACTIVE barbers. ' +
      'Staff and owners see all statuses for their salon. ' +
      'Supports ?salonId=, ?search=, ?isAvailable=, ?status=, ?sortBy=, ?page=, ?limit=',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of BarberResponseDto' })
  findAll(
    @Query() query: BarberQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.barberService.findAll(query, requester);
  }

  // ─── Public: single barber ────────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get barber details' })
  @ApiParam({ name: 'id', description: 'Barber UUID' })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BarberResponseDto> {
    return this.barberService.findOne(id);
  }

  // ─── Create barber ────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.BARBER_CREATE)
  @ApiOperation({
    summary: 'Add a barber to a salon',
    description:
      'Creates a new barber profile. The barber may optionally be linked to an existing user account. ' +
      'Requires BARBER_CREATE permission (SALON_OWNER, SUPER_ADMIN).',
  })
  @ApiResponse({ status: 201, type: BarberResponseDto })
  create(
    @Body() dto: CreateBarberDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<BarberResponseDto> {
    return this.barberService.create(dto, requester);
  }

  // ─── Update barber ────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions(Permission.BARBER_UPDATE)
  @ApiOperation({
    summary: 'Update barber profile',
    description:
      'SALON_OWNER and STAFF can update barbers in their salon. ' +
      'SUPER_ADMIN can update any barber.',
  })
  @ApiParam({ name: 'id', description: 'Barber UUID' })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarberDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<BarberResponseDto> {
    return this.barberService.update(id, dto, requester);
  }

  // ─── Set availability ─────────────────────────────────────────────────────

  /**
   * PATCH /barbers/:id/availability
   * Front-desk staff toggle barber availability (busy/free) in real time.
   * The barber themselves (if linked to a user account) can also set their own.
   */
  @Patch(':id/availability')
  @RequirePermissions(Permission.BARBER_UPDATE)
  @ApiOperation({
    summary: 'Set barber availability (available / unavailable)',
    description:
      'Quick toggle for real-time floor management. ' +
      'STAFF, SALON_OWNER, SUPER_ADMIN, or the barber's own linked user account can call this.',
  })
  @ApiParam({ name: 'id', description: 'Barber UUID' })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  setAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<BarberResponseDto> {
    return this.barberService.setAvailability(id, dto, requester);
  }

  // ─── Delete barber ────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions(Permission.BARBER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a barber',
    description:
      'Sets deletedAt. Preserves historical queue / appointment data.',
  })
  @ApiParam({ name: 'id', description: 'Barber UUID' })
  @ApiResponse({ status: 204 })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.barberService.remove(id, requester);
  }
}
