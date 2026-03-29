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
import { UpdateSalonDto } from './dto/update-salon.dto';
import { ApproveSalonDto } from './dto/approve-salon.dto';
import { RejectSalonDto } from './dto/reject-salon.dto';
import { SalonQueryDto } from './dto/salon-query.dto';
import { SalonResponseDto } from './dto/salon-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { SalonStatus } from '@common/enums/status.enum';
import { Permission } from '@common/enums/permission.enum';
import { canPerform } from '@common/rbac/rbac.util';

@Injectable()
export class SalonService {
  constructor(
    @InjectRepository(Salon)
    private readonly salonRepo: Repository<Salon>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateSalonDto, requester: JwtPayload): Promise<SalonResponseDto> {
    const slug = await this.generateUniqueSlug(dto.name);

    const salon = this.salonRepo.create({
      ownerId:                  requester.sub,
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
      phone:                    dto.phone ?? null,
      email:                    dto.email ?? null,
      logoUrl:                  dto.logoUrl ?? null,
      coverImageUrl:            dto.coverImageUrl ?? null,
      avgServiceDurationMinutes: dto.avgServiceDurationMinutes ?? 30,
      maxQueueSize:             dto.maxQueueSize ?? 20,
      workingHours:             dto.workingHours ?? null,
      timezone:                 dto.timezone ?? 'UTC',
      status:                   SalonStatus.PENDING,
    });

    return SalonResponseDto.from(await this.salonRepo.save(salon));
  }

  // ─── Read: public list ────────────────────────────────────────────────────

  async findAll(
    query: SalonQueryDto,
    requester?: JwtPayload,
  ): Promise<PaginatedResult<SalonResponseDto>> {
    const qb = this.salonRepo
      .createQueryBuilder('salon')
      .where('salon.deletedAt IS NULL');

    // Public (unauthenticated) callers see only active salons.
    // Admins / onboarding staff can see all statuses.
    const canSeeAll =
      requester &&
      (requester.role === Role.SUPER_ADMIN ||
        requester.role === Role.ONBOARDING_STAFF);

    if (!canSeeAll) {
      qb.andWhere('salon.status = :active', { active: SalonStatus.ACTIVE });
    } else if (query.status) {
      qb.andWhere('salon.status = :status', { status: query.status });
    }

    // SALON_OWNER sees only their own salons (regardless of status)
    if (requester?.role === Role.SALON_OWNER) {
      qb.andWhere('salon.ownerId = :ownerId', { ownerId: requester.sub });
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

  async findOne(id: string, requester?: JwtPayload): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);
    this.assertReadAccess(salon, requester);
    return SalonResponseDto.from(salon);
  }

  // ─── Update: owner or admin ───────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateSalonDto,
    requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);
    this.assertWriteAccess(salon, requester);

    // Owners can only update active or inactive salons (not suspended/archived)
    if (
      requester.role === Role.SALON_OWNER &&
      salon.status !== SalonStatus.ACTIVE &&
      salon.status !== SalonStatus.INACTIVE &&
      salon.status !== SalonStatus.PENDING
    ) {
      throw new BadRequestException(
        `Cannot update a salon with status: ${salon.status}`,
      );
    }

    // Regenerate slug only if name changed
    if (dto.name && dto.name !== salon.name) {
      salon.slug = await this.generateUniqueSlug(dto.name, id);
    }

    Object.assign(salon, dto);
    return SalonResponseDto.from(await this.salonRepo.save(salon));
  }

  // ─── Approve ─────────────────────────────────────────────────────────────

  async approve(
    id: string,
    dto: ApproveSalonDto,
    requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);

    if (salon.status !== SalonStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING salons can be approved. Current status: ${salon.status}`,
      );
    }

    salon.status         = SalonStatus.ACTIVE;
    salon.isVerified     = true;
    salon.verifiedBy     = requester.sub;
    salon.verifiedAt     = new Date();
    salon.rejectionReason = null;

    return SalonResponseDto.from(await this.salonRepo.save(salon));
  }

  // ─── Reject ───────────────────────────────────────────────────────────────

  async reject(
    id: string,
    dto: RejectSalonDto,
    requester: JwtPayload,
  ): Promise<SalonResponseDto> {
    const salon = await this.findEntityOrFail(id);

    if (salon.status !== SalonStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING salons can be rejected. Current status: ${salon.status}`,
      );
    }

    salon.status          = SalonStatus.REJECTED;
    salon.verifiedBy      = requester.sub;
    salon.rejectionReason = dto.reason;

    return SalonResponseDto.from(await this.salonRepo.save(salon));
  }

  // ─── Archive (soft status change, owner or admin) ─────────────────────────

  async archive(id: string, requester: JwtPayload): Promise<void> {
    const salon = await this.findEntityOrFail(id);
    this.assertWriteAccess(salon, requester);

    if (salon.status === SalonStatus.ARCHIVED) {
      throw new BadRequestException('Salon is already archived');
    }

    salon.status = SalonStatus.ARCHIVED;
    await this.salonRepo.save(salon);
  }

  // ─── Hard soft-delete (SUPER_ADMIN only) ─────────────────────────────────

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const salon = await this.findEntityOrFail(id);

    if (requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can permanently delete a salon');
    }

    await this.salonRepo.softRemove(salon);
  }

  // ─── Internal (used by other modules) ────────────────────────────────────

  async findEntityOrFail(id: string): Promise<Salon> {
    const salon = await this.salonRepo.findOne({ where: { id } });
    if (!salon) throw new NotFoundException('Salon not found');
    return salon;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

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
    if (role === Role.SALON_OWNER && salon.ownerId === requester.sub) return;

    throw new NotFoundException('Salon not found');
  }

  /**
   * Asserts the requester can write to this salon.
   * SUPER_ADMIN → always allowed.
   * SALON_OWNER → only their own salon.
   * Others      → forbidden.
   */
  private assertWriteAccess(salon: Salon, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      canPerform(requester.role, Permission.SALON_UPDATE_OWN) &&
      salon.ownerId === requester.sub
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to modify this salon');
  }

  /**
   * Converts a salon name into a URL-safe slug and appends a numeric suffix
   * if the base slug is already taken.
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
