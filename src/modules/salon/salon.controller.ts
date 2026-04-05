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
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiConflictErrors,
  ApiCreatedWrapped,
  ApiOkWrapped,
  ApiPaginatedResponse,
} from '@common/swagger/decorators';
import { SalonService } from './salon.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { ApproveSalonDto } from './dto/approve-salon.dto';
import { RejectSalonDto } from './dto/reject-salon.dto';
import { SalonQueryDto } from './dto/salon-query.dto';
import { SalonResponseDto } from './dto/salon-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * REST controller for salon management.
 *
 * Handles creation, retrieval, update, approval/rejection, archiving, and
 * soft-deletion of salon records. Access rules vary by endpoint — see each
 * method for the exact permission requirements.
 *
 * Base route: `/salons`
 */
@ApiTags('Salons')
@ApiBearerAuth('bearer')
@Controller('salons')
export class SalonController {
  constructor(private readonly salonService: SalonService) {}

  // ─── Public: browse active salons ─────────────────────────────────────────

  /**
   * GET /salons
   * Public: returns only ACTIVE salons.
   * Authenticated admins & onboarding staff: all statuses with optional filter.
   * SALON_OWNER: their own salons (any status).
   *
   * @param query - Pagination, search, status filter, and sort options.
   * @param requester - JWT payload of the authenticated caller (may be undefined for public calls).
   * @returns Paginated list of salons visible to the caller.
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'List salons',
    description:
      'Public callers see only ACTIVE salons. ' +
      'Admins and onboarding staff see all statuses and can filter by ?status=. ' +
      'Salon owners see their own salons in any status.',
  })
  @ApiPaginatedResponse(SalonResponseDto)
  @ApiAuthErrors()
  findAll(
    @Query() query: SalonQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.salonService.findAll(query, requester);
  }

  // ─── Public: single salon detail ──────────────────────────────────────────

  /**
   * GET /salons/:id
   * Active salons are publicly readable. Non-active salons are visible only to
   * the owner, onboarding staff, or super admin.
   *
   * @param id - UUID of the salon to retrieve.
   * @param requester - JWT payload of the authenticated caller.
   * @returns The salon details if the caller has read access.
   * @throws NotFoundException when the salon does not exist or the caller lacks read access.
   */
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get salon details',
    description:
      'Active salons are publicly readable. ' +
      'Non-active salons are visible only to the owner, onboarding staff, or super admin.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiOkWrapped(SalonResponseDto)
  @ApiCommonErrors()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.findOne(id, requester);
  }

  // ─── Create a salon ───────────────────────────────────────────────────────

  /**
   * POST /salons
   * The authenticated user becomes the salon owner.
   * Requires SALON_CREATE permission (granted to SALON_OWNER, SUPER_ADMIN).
   *
   * @param dto - Salon creation payload.
   * @param requester - JWT payload of the authenticated caller who will own the salon.
   * @returns The newly created salon in PENDING status.
   * @throws ConflictException when a slug collision cannot be resolved.
   */
  @Post()
  @RequirePermissions(Permission.SALON_CREATE)
  @ApiOperation({
    summary: 'Register a new salon',
    description:
      'Creates a salon in PENDING status assigned to the authenticated user. ' +
      'An onboarding staff member must approve it before it goes ACTIVE.',
  })
  @ApiCreatedWrapped(SalonResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  create(
    @Body() dto: CreateSalonDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.create(dto, requester);
  }

  // ─── Update salon ─────────────────────────────────────────────────────────

  /**
   * PATCH /salons/:id
   * SALON_OWNER: can update their own salon.
   * SUPER_ADMIN: can update any salon (SALON_UPDATE_ANY bypasses ownership).
   * The service enforces ownership for non-admins.
   *
   * @param id - UUID of the salon to update.
   * @param dto - Fields to update (all optional).
   * @param requester - JWT payload of the authenticated caller.
   * @returns The updated salon.
   * @throws ForbiddenException when the caller does not own the salon and is not SUPER_ADMIN.
   * @throws BadRequestException when the salon status prevents updates.
   */
  @Patch(':id')
  @RequirePermissions(Permission.SALON_UPDATE_OWN)
  @ApiOperation({
    summary: 'Update salon details',
    description:
      'SALON_OWNER can update their own salon. ' +
      'SUPER_ADMIN can update any salon.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiOkWrapped(SalonResponseDto)
  @ApiCommonErrors()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalonDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.update(id, dto, requester);
  }

  // ─── Approve ──────────────────────────────────────────────────────────────

  /**
   * PATCH /salons/:id/approve
   * Sets status=ACTIVE, isVerified=true, records verifier.
   * Only ONBOARDING_STAFF and SUPER_ADMIN can approve.
   *
   * @param id - UUID of the salon to approve.
   * @param dto - Optional approval note.
   * @param requester - JWT payload of the onboarding staff or super admin.
   * @returns The approved salon with status ACTIVE.
   * @throws BadRequestException when the salon is not in PENDING status.
   */
  @Patch(':id/approve')
  @Roles(Role.ONBOARDING_STAFF, Role.SUPER_ADMIN)
  @RequirePermissions(Permission.SALON_VERIFY)
  @ApiOperation({
    summary: 'Approve a pending salon registration',
    description:
      'Transitions salon from PENDING → ACTIVE. ' +
      'Records the verifier and timestamp. ' +
      'Requires ONBOARDING_STAFF or SUPER_ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiOkWrapped(SalonResponseDto)
  @ApiCommonErrors()
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveSalonDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.approve(id, dto, requester);
  }

  // ─── Reject ───────────────────────────────────────────────────────────────

  /**
   * PATCH /salons/:id/reject
   * Sets status=REJECTED, records the reason.
   * Only ONBOARDING_STAFF and SUPER_ADMIN can reject.
   *
   * @param id - UUID of the salon to reject.
   * @param dto - Rejection reason payload.
   * @param requester - JWT payload of the onboarding staff or super admin.
   * @returns The rejected salon with status REJECTED.
   * @throws BadRequestException when the salon is not in PENDING status.
   */
  @Patch(':id/reject')
  @Roles(Role.ONBOARDING_STAFF, Role.SUPER_ADMIN)
  @RequirePermissions(Permission.SALON_VERIFY)
  @ApiOperation({
    summary: 'Reject a pending salon registration',
    description:
      'Transitions salon from PENDING → REJECTED. ' +
      'The rejection reason is stored on the salon record.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiOkWrapped(SalonResponseDto)
  @ApiCommonErrors()
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSalonDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.reject(id, dto, requester);
  }

  // ─── Archive ──────────────────────────────────────────────────────────────

  /**
   * PATCH /salons/:id/archive
   * Soft status transition → ARCHIVED.
   * Owner can archive their own salon; SUPER_ADMIN can archive any.
   *
   * @param id - UUID of the salon to archive.
   * @param requester - JWT payload of the caller.
   * @returns void (204 No Content).
   * @throws BadRequestException when the salon is already archived.
   * @throws ForbiddenException when the caller does not own the salon and is not SUPER_ADMIN.
   */
  @Patch(':id/archive')
  @RequirePermissions(Permission.SALON_DELETE_OWN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a salon (status → ARCHIVED)',
    description:
      'The salon record is preserved but the salon is no longer publicly listed. ' +
      'Owner can archive their own; SUPER_ADMIN can archive any.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiNoContentResponse({ description: 'Salon archived.' })
  @ApiCommonErrors()
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.salonService.archive(id, requester);
  }

  // ─── Permanent soft-delete (SUPER_ADMIN only) ─────────────────────────────

  /**
   * DELETE /salons/:id
   * Sets deletedAt — row is preserved but invisible to all queries.
   * Restricted to SUPER_ADMIN.
   *
   * @param id - UUID of the salon to soft-delete.
   * @param requester - JWT payload of the super admin caller.
   * @returns void (204 No Content).
   * @throws ForbiddenException when the caller is not SUPER_ADMIN.
   */
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a salon (SUPER_ADMIN only)',
    description:
      'Sets deletedAt. The salon disappears from all queries but the row is retained. ' +
      'Use archive for a reversible equivalent.',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiNoContentResponse({ description: 'Salon deleted.' })
  @ApiCommonErrors()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.salonService.remove(id, requester);
  }
}
