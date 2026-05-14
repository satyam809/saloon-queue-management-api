import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { imageUploadOptions } from '@modules/upload/multer.options';
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
   * PUT /salons/:id
   * Update salon details and/or replace its logo / cover image in one request.
   * Send as `multipart/form-data`; all fields are optional.
   * SALON_OWNER: can update their own salon.
   * SUPER_ADMIN: can update any salon.
   *
   * @param id - UUID of the salon to update.
   * @param dto - Text fields to update (all optional).
   * @param files - Optional image files (`logo`, `cover`).
   * @param requester - JWT payload of the authenticated caller.
   * @returns The updated salon.
   */
  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }],
      imageUploadOptions('salons'),
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update salon',
    description:
      'Update details, upload images, approve, reject, or archive — all in one request. ' +
      'Send as multipart/form-data. All fields are optional.\n\n' +
      '**status field behaviour:**\n' +
      '- `active` → approve (ONBOARDING_STAFF / SUPER_ADMIN only, salon must be PENDING)\n' +
      '- `rejected` → reject (ONBOARDING_STAFF / SUPER_ADMIN only, `rejectionReason` required)\n' +
      '- `archived` → archive (owner or SUPER_ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'Salon UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name:                     { type: 'string' },
        description:              { type: 'string' },
        address:                  { type: 'string' },
        city:                     { type: 'string' },
        state:                    { type: 'string' },
        country:                  { type: 'string' },
        postalCode:               { type: 'string' },
        latitude:                 { type: 'number' },
        longitude:                { type: 'number' },
        phone:                    { type: 'string' },
        email:                    { type: 'string' },
        avgServiceDurationMinutes: { type: 'integer' },
        maxQueueSize:             { type: 'integer' },
        timezone:                 { type: 'string' },
        status:          { type: 'string', enum: ['active', 'rejected', 'archived'], description: 'Trigger a status transition' },
        rejectionReason: { type: 'string', description: 'Required when status is rejected' },
        logo:  { type: 'string', format: 'binary', description: 'Logo image (JPEG/PNG/WebP/GIF, max 5 MB)' },
        cover: { type: 'string', format: 'binary', description: 'Cover image (JPEG/PNG/WebP/GIF, max 5 MB)' },
      },
    },
  })
  @ApiOkWrapped(SalonResponseDto)
  @ApiCommonErrors()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalonDto,
    @UploadedFiles() files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
    @CurrentUser() requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    return this.salonService.update(id, dto, files, requester);
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
