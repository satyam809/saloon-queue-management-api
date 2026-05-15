import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salon } from './entities/salon.entity';
import { CreateSalonDto } from './dto/create-salon.dto';
import { RegisterSalonDto } from './dto/register-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SalonQueryDto } from './dto/salon-query.dto';
import { SalonResponseDto } from './dto/salon-response.dto';
import { SalonRegistrationResponseDto } from './dto/salon-registration-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { SalonStatus } from '@common/enums/status.enum';
import { Permission } from '@common/enums/permission.enum';
import { canPerform } from '@common/rbac/rbac.util';
import { UploadService } from '@modules/upload/upload.service';
import { UserService } from '@modules/user/user.service';
import { AuthService } from '@modules/auth/auth.service';

/**
 * Business logic service for salon management.
 *
 * Handles all CRUD operations, status transitions (approve, reject, archive),
 * and access-control enforcement for salon records. Exported so that other
 * modules can use {@link findEntityOrFail} for FK validation.
 */
@Injectable()
export class SalonService {
  constructor(
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
    private readonly uploadService: UploadService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  // ─── Register (self-registration: new owner + salon in one request) ─────────

  /**
   * Creates a SALON_OWNER user account and a salon in PENDING status atomically.
   * Called when POST /salons is invoked without an existing authenticated session.
   *
   * If salon creation fails after the user has been persisted, a soft-delete
   * compensating action frees the email address for a subsequent retry.
   *
   * @param dto - Full salon payload plus the nested `owner` registration fields.
   * @returns JWT token pair, the new owner's profile, and the created salon.
   */
  async register(
    dto: RegisterSalonDto,
    files?: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ): Promise<SalonRegistrationResponseDto> {
    const owner = dto.owner!;

    const user = await this.userService.createWithRole({
      name:     owner.name,
      email:    owner.email,
      password: owner.password,
      phone:    owner.phone,
      role:     Role.SALON_OWNER,
    });

    const ownerPayload: JwtPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role as Role,
    };

    const { owner: _, ...salonFields } = dto;

    let salon: SalonResponseDto;
    try {
      salon = await this.create(salonFields as CreateSalonDto, ownerPayload, files);
    } catch (err) {
      await this.userService.softDeleteById(user.id);
      throw err;
    }

    await this.userService.updateLastLogin(user.id);
    const tokens = await this.authService.generateTokens(user);

    return {
      tokens,
      user: {
        id:        user.id,
        name:      user.name,
        email:     user.email,
        role:      user.role as Role,
        avatarUrl: user.avatarUrl ?? null,
      },
      salon,
    };
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a new salon in PENDING status owned by the requester.
   *
   * A unique URL-safe slug is generated from the salon name. The salon must
   * be approved by onboarding staff before it becomes publicly visible.
   *
   * @param dto - Salon creation payload.
   * @param requester - JWT payload of the authenticated owner.
   * @returns The persisted salon mapped to {@link SalonResponseDto}.
   */
  async create(
    dto: CreateSalonDto,
    requester: JwtPayload,
    files?: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ): Promise<SalonResponseDto> {
    const slug = await this.generateUniqueSlug(dto.name);

    const salon = this.salonRepo.create({
      addedById:                requester.sub,
      name:                     dto.name,
      slug,
      description:              dto.description ?? null,
      address:                  dto.address ?? null,
      city:                     dto.city ?? null,
      state:                    dto.state ?? null,
      country:                  dto.country ?? 'US',
      postalCode:               dto.postalCode ?? null,
      latitude:                 dto.latitude ?? null,
      longitude:                dto.longitude ?? null,
      logoUrl:                  files?.logo?.[0]
                                  ? `/uploads/salons/${files.logo[0].filename}`
                                  : (dto.logoUrl ?? null),
      coverImageUrl:            files?.cover?.[0]
                                  ? `/uploads/salons/${files.cover[0].filename}`
                                  : (dto.coverImageUrl ?? null),
      avgServiceDurationMinutes: dto.avgServiceDurationMinutes ?? 30,
      maxQueueSize:             dto.maxQueueSize ?? 20,
      workingHours:             dto.workingHours ?? null,
      timezone:                 dto.timezone ?? 'UTC',
      status:                   SalonStatus.PENDING,
    });

    return SalonResponseDto.from(await this.salonRepo.save(salon));
  }

  // ─── Read: public list ────────────────────────────────────────────────────

  /**
   * Returns a paginated list of salons filtered by the caller's access level.
   *
   * - Unauthenticated callers: only ACTIVE salons.
   * - SUPER_ADMIN / ONBOARDING_STAFF: all statuses (optional `query.status` filter).
   * - SALON_OWNER: their own salons in any status.
   *
   * @param query - Pagination, search, status filter, and sort options.
   * @param requester - Optional JWT payload; absent for public/unauthenticated requests.
   * @returns Paginated list of salons mapped to {@link SalonResponseDto}.
   */
  async findAll(
    query: SalonQueryDto,
    requester?: JwtPayload,
  ): Promise<PaginatedResult<SalonResponseDto>> {
    const qb = this.salonRepo
      .createQueryBuilder('salon')
      .leftJoinAndSelect('salon.addedBy', 'addedBy')
      .where('salon.deletedAt IS NULL');
    if (requester?.role === Role.SUPER_ADMIN) {
      // Super admin sees every salon; optional status filter
      if (query.status) {
        qb.andWhere('salon.status = :status', { status: query.status });
      }
    } else if (
      requester?.role === Role.ONBOARDING_STAFF ||
      requester?.role === Role.SALON_OWNER
    ) {
      // Onboarding staff and salon owners see only their own salons
      qb.andWhere('salon.addedById = :addedById', { addedById: requester.sub });
      if (query.status) {
        qb.andWhere('salon.status = :status', { status: query.status });
      }
    } else {
      // Unauthenticated / other roles see only active salons
      qb.andWhere('salon.status = :active', { active: SalonStatus.ACTIVE });
    }

    if (query.search?.trim()) {
      qb.andWhere('salon.name LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.city?.trim()) {
      qb.andWhere('salon.city LIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    const sortField = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`salon.${sortField}`, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data.map(SalonResponseDto.from), total, query.page, query.limit);
  }

  // ─── Read: single salon ───────────────────────────────────────────────────

  /**
   * Retrieves a single salon by ID, enforcing read-access rules.
   *
   * @param id - UUID of the salon.
   * @param requester - Optional JWT payload of the caller.
   * @returns The salon mapped to {@link SalonResponseDto}.
   * @throws NotFoundException when the salon does not exist or the caller lacks read access.
   */
  async findOne(id: string, requester?: JwtPayload): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);
    this.assertReadAccess(salon, requester);
    return SalonResponseDto.from(salon);
  }

  // ─── Update (data + images + status transitions) ─────────────────────────

  /**
   * Unified update: edits salon fields, replaces images, and/or transitions status —
   * all in one request. Authorization is checked contextually:
   *
   * - Status → ACTIVE (approve): ONBOARDING_STAFF or SUPER_ADMIN; salon must be PENDING.
   * - Status → REJECTED: ONBOARDING_STAFF or SUPER_ADMIN; salon must be PENDING; rejectionReason required.
   * - Status → ARCHIVED: owner or SUPER_ADMIN; salon must not already be ARCHIVED.
   * - Field/image updates: owner (ACTIVE/INACTIVE/PENDING only) or SUPER_ADMIN.
   */
  async update(
    id: string,
    dto: UpdateSalonDto,
    files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
    requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);

    if (dto.status) {
      this.applyStatusTransition(salon, dto, requester);
    }

    const { status, rejectionReason, owner, ...fields } = dto;

    if (Object.keys(fields).length || files?.logo?.[0] || files?.cover?.[0]) {
      this.assertWriteAccess(salon, requester);

      if (
        requester.role === Role.SALON_OWNER &&
        salon.status !== SalonStatus.ACTIVE &&
        salon.status !== SalonStatus.INACTIVE &&
        salon.status !== SalonStatus.PENDING
      ) {
        throw new BadRequestException(`Cannot update a salon with status: ${salon.status}`);
      }

      if (fields.name && fields.name !== salon.name) {
        salon.slug = await this.generateUniqueSlug(fields.name, id);
      }

      Object.assign(salon, fields);

      if (files?.logo?.[0]) {
        if (salon.logoUrl?.startsWith('/uploads/')) this.uploadService.deleteFile(salon.logoUrl);
        salon.logoUrl = `/uploads/salons/${files.logo[0].filename}`;
      }

      if (files?.cover?.[0]) {
        if (salon.coverImageUrl?.startsWith('/uploads/')) this.uploadService.deleteFile(salon.coverImageUrl);
        salon.coverImageUrl = `/uploads/salons/${files.cover[0].filename}`;
      }
    }

    if (owner) {
      if (requester.role !== Role.SUPER_ADMIN && salon.addedById !== requester.sub) {
        throw new ForbiddenException('You do not have permission to update owner details');
      }
      await this.userService.updateOwnerDetails(
        salon.addedById,
        owner,
        requester.role === Role.SUPER_ADMIN,
      );
    }

    await this.salonRepo.save(salon);
    return SalonResponseDto.from(await this.findEntityOrFail(id));
  }

  private applyStatusTransition(salon: Salon, dto: UpdateSalonDto, requester: JwtPayload): void {
    const isStaffOrAdmin =
      requester.role === Role.ONBOARDING_STAFF || requester.role === Role.SUPER_ADMIN;

    switch (dto.status) {
      case SalonStatus.ACTIVE:
        if (!isStaffOrAdmin) throw new ForbiddenException('Only ONBOARDING_STAFF or SUPER_ADMIN can approve salons');
        if (salon.status !== SalonStatus.PENDING) throw new BadRequestException(`Only PENDING salons can be approved. Current status: ${salon.status}`);
        salon.status          = SalonStatus.ACTIVE;
        salon.isVerified      = true;
        salon.verifiedBy      = requester.sub;
        salon.verifiedAt      = new Date();
        salon.rejectionReason = null;
        break;

      case SalonStatus.REJECTED:
        if (!isStaffOrAdmin) throw new ForbiddenException('Only ONBOARDING_STAFF or SUPER_ADMIN can reject salons');
        if (salon.status !== SalonStatus.PENDING) throw new BadRequestException(`Only PENDING salons can be rejected. Current status: ${salon.status}`);
        if (!dto.rejectionReason) throw new BadRequestException('rejectionReason is required when rejecting a salon');
        salon.status          = SalonStatus.REJECTED;
        salon.verifiedBy      = requester.sub;
        salon.rejectionReason = dto.rejectionReason;
        break;

      case SalonStatus.ARCHIVED:
        this.assertWriteAccess(salon, requester);
        if (salon.status === SalonStatus.ARCHIVED) throw new BadRequestException('Salon is already archived');
        salon.status = SalonStatus.ARCHIVED;
        break;

      default:
        throw new BadRequestException(`Status '${dto.status}' cannot be set via this endpoint`);
    }
  }

  // ─── Hard soft-delete (SUPER_ADMIN only) ─────────────────────────────────

  /**
   * Soft-deletes a salon by setting `deletedAt`.
   *
   * The row is retained for historical reference but is excluded from all
   * standard queries. Only SUPER_ADMIN may call this operation.
   *
   * @param id - UUID of the salon to delete.
   * @param requester - JWT payload of the super admin.
   * @throws ForbiddenException when the caller is not SUPER_ADMIN.
   */
  async remove(id: string, requester: JwtPayload): Promise<void> {
    const salon = await this.findEntityOrFail(id);

    if (requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can permanently delete a salon');
    }

    await this.salonRepo.softRemove(salon);
  }

  // ─── Internal (used by other modules) ────────────────────────────────────

  /**
   * Loads a {@link Salon} entity by primary key or throws {@link NotFoundException}.
   *
   * Intended for use by this service and by other modules that need to validate
   * a salon FK (e.g. BarberModule, ServiceModule) without duplicating lookup logic.
   *
   * @param id - UUID of the salon.
   * @returns The found {@link Salon} entity.
   * @throws NotFoundException when no salon with the given ID exists.
   */
  async findEntityOrFail(id: string): Promise<Salon> {
    const salon = await this.salonRepo.findOne({ where: { id }, relations: { addedBy: true } });
    if (!salon) throw new NotFoundException('Salon not found');
    return salon;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Asserts the requester has read access to the given salon.
   *
   * - ACTIVE salons are publicly readable.
   * - Unauthenticated callers receive a 404 for non-active salons (to avoid leaking existence).
   * - SUPER_ADMIN and ONBOARDING_STAFF can read any salon.
   * - SALON_OWNER can read their own salon regardless of status.
   *
   * @param salon - The salon entity to check.
   * @param requester - Optional JWT payload of the caller.
   * @throws NotFoundException when the caller lacks read access.
   */
  private assertReadAccess(salon: Salon, requester?: JwtPayload): void {
    // Active salons are publicly readable
    if (salon.status === SalonStatus.ACTIVE) return;

    // Unauthenticated callers cannot see non-active salons
    if (!requester) {
      throw new NotFoundException('Salon not found');
    }

    const role = requester.role;

    // Admins and onboarding staff see all
    if (role === Role.SUPER_ADMIN || role === Role.ONBOARDING_STAFF) return;

    // Salon owner can see their own salon regardless of status
    if (role === Role.SALON_OWNER && salon.addedById === requester.sub) return;

    throw new NotFoundException('Salon not found');
  }

  /**
   * Asserts the requester can write to this salon.
   * SUPER_ADMIN → always allowed.
   * SALON_OWNER → only their own salon.
   * Others      → forbidden.
   *
   * @param salon - The salon entity to check.
   * @param requester - JWT payload of the caller.
   * @throws ForbiddenException when the caller is not the owner and not SUPER_ADMIN.
   */
  private assertWriteAccess(salon: Salon, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      canPerform(requester.role, Permission.SALON_UPDATE_OWN) &&
      salon.addedById === requester.sub
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to modify this salon');
  }

  /**
   * Converts a salon name into a URL-safe slug and appends a numeric suffix
   * if the base slug is already taken.
   *
   * @param name - The human-readable salon name to slugify.
   * @param excludeId - Optional salon UUID to exclude from the uniqueness check (used on update).
   * @returns A unique slug string safe for use in URLs.
   */
  private async generateUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 140); // leave room for suffix

    let slug   = base;
    let suffix = 1;

    while (true) {
      const qb = this.salonRepo
        .createQueryBuilder('salon')
        .where('salon.slug = :slug', { slug })
        .andWhere('salon.deletedAt IS NULL');

      if (excludeId) {
        qb.andWhere('salon.id != :excludeId', { excludeId });
      }

      const existing = await qb.getOne();
      if (!existing) break;

      slug = `${base}-${suffix}`;
      suffix++;
    }

    return slug;
  }
}
