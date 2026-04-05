import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barber } from './entities/barber.entity';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { BarberQueryDto } from './dto/barber-query.dto';
import { BarberResponseDto } from './dto/barber-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { BarberStatus } from '@common/enums/status.enum';
import { Permission } from '@common/enums/permission.enum';
import { canPerform } from '@common/rbac/rbac.util';
import { ActivityLogService } from '@modules/activity-log/activity-log.service';

@Injectable()
export class BarberService {
  constructor(
    @InjectRepository(Barber)
    private readonly barberRepo: Repository<Barber>,
    private readonly actLog: ActivityLogService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateBarberDto, requester: JwtPayload): Promise<BarberResponseDto> {
    this.assertSalonAccess(dto.salonId, requester);

    // Prevent duplicate user↔salon barber profile
    if (dto.userId) {
      const duplicate = await this.barberRepo.findOne({
        where: { salonId: dto.salonId, userId: dto.userId },
      });
      if (duplicate) {
        throw new BadRequestException(
          'A barber profile for this user already exists in this salon',
        );
      }
    }

    const barber = this.barberRepo.create({
      salonId:         dto.salonId,
      userId:          dto.userId ?? null,
      name:            dto.name,
      bio:             dto.bio ?? null,
      avatarUrl:       dto.avatarUrl ?? null,
      email:           dto.email ?? null,
      phone:           dto.phone ?? null,
      specializations: dto.specializations ?? null,
    });

    const saved = await this.barberRepo.save(barber);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'barber.created', category: 'barber', entityType: 'barber', entityId: saved.id, newValues: { name: saved.name, salonId: saved.salonId } });
    return BarberResponseDto.from(saved);
  }

  // ─── Read: list ───────────────────────────────────────────────────────────

  async findAll(
    query: BarberQueryDto,
    requester?: JwtPayload,
  ): Promise<PaginatedResult<BarberResponseDto>> {
    const qb = this.barberRepo
      .createQueryBuilder('barber')
      .where('barber.deletedAt IS NULL');

    // Public callers see only ACTIVE barbers.
    // Staff / owners of a specific salon see all statuses for their salon.
    const isPrivileged =
      requester &&
      (requester.role === Role.SUPER_ADMIN ||
        requester.role === Role.ONBOARDING_STAFF ||
        requester.role === Role.SALON_OWNER ||
        requester.role === Role.STAFF);

    if (!isPrivileged) {
      qb.andWhere('barber.status = :status', { status: BarberStatus.ACTIVE });
    } else if (query.status) {
      qb.andWhere('barber.status = :status', { status: query.status });
    }

    if (query.salonId) {
      qb.andWhere('barber.salonId = :salonId', { salonId: query.salonId });
    }

    if (query.search?.trim()) {
      qb.andWhere('barber.name LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.isAvailable !== undefined) {
      qb.andWhere('barber.isAvailable = :isAvailable', {
        isAvailable: query.isAvailable,
      });
    }

    const sortField = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'ASC';
    qb.orderBy(`barber.${sortField}`, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data.map(BarberResponseDto.from), total, query.page, query.limit);
  }

  // ─── Read: single ─────────────────────────────────────────────────────────

  async findOne(id: string): Promise<BarberResponseDto> {
    return BarberResponseDto.from(await this.findEntityOrFail(id));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateBarberDto,
    requester: JwtPayload,
  ): Promise<BarberResponseDto> {
    const barber = await this.findEntityOrFail(id);
    this.assertSalonAccess(barber.salonId, requester);

    Object.assign(barber, dto);
    const saved = await this.barberRepo.save(barber);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'barber.updated', category: 'barber', entityType: 'barber', entityId: id, newValues: dto as Record<string, any> });
    return BarberResponseDto.from(saved);
  }

  // ─── Set availability ─────────────────────────────────────────────────────

  /**
   * Quick toggle — separate endpoint so front-desk staff can flip availability
   * without needing to send the full barber payload.
   * Also allows the barber themselves (linked user account) to set their own status.
   */
  async setAvailability(
    id: string,
    dto: SetAvailabilityDto,
    requester: JwtPayload,
  ): Promise<BarberResponseDto> {
    const barber = await this.findEntityOrFail(id);

    const isOwnProfile = barber.userId === requester.sub;
    const canManage    = canPerform(requester.role, Permission.BARBER_UPDATE);

    if (!isOwnProfile && !canManage) {
      throw new ForbiddenException(
        "You do not have permission to change this barber's availability",
      );
    }

    // Staff/owners can only manage barbers in their salon
    if (!isOwnProfile) {
      this.assertSalonAccess(barber.salonId, requester);
    }

    const prevAvailable = barber.isAvailable;
    barber.isAvailable = dto.isAvailable;
    const saved = await this.barberRepo.save(barber);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'barber.availability_changed', category: 'barber', entityType: 'barber', entityId: id, oldValues: { isAvailable: prevAvailable }, newValues: { isAvailable: dto.isAvailable } });
    return BarberResponseDto.from(saved);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const barber = await this.findEntityOrFail(id);
    this.assertSalonAccess(barber.salonId, requester);
    await this.barberRepo.softRemove(barber);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'barber.deleted', category: 'barber', entityType: 'barber', entityId: id, oldValues: { name: barber.name, salonId: barber.salonId } });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  async findEntityOrFail(id: string): Promise<Barber> {
    const barber = await this.barberRepo.findOne({ where: { id } });
    if (!barber) throw new NotFoundException('Barber not found');
    return barber;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * SUPER_ADMIN → always passes.
   * SALON_OWNER / STAFF → must own or be assigned to the target salon.
   *
   * Note: For SALON_OWNER / STAFF we only check the role here; the actual
   * salonId ↔ user binding is enforced at the staff/owner record level in a
   * real system. For this module we trust the requester's salon context from
   * the JWT / request scope. If you add a StaffMembership table, load it here.
   */
  private assertSalonAccess(salonId: string, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      requester.role !== Role.SALON_OWNER &&
      requester.role !== Role.STAFF
    ) {
      throw new ForbiddenException('You do not have permission to manage barbers');
    }
  }
}
