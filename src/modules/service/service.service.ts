import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { BarberService as BarberServiceEntity } from './entities/barber-service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AssignBarberDto } from './dto/assign-barber.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { ActivityLogService } from '@modules/activity-log/activity-log.service';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(BarberServiceEntity)
    private readonly barberServiceRepo: Repository<BarberServiceEntity>,
    private readonly actLog: ActivityLogService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateServiceDto, requester: JwtPayload): Promise<ServiceResponseDto> {
    this.assertSalonAccess(dto.salonId, requester);

    const service = this.serviceRepo.create({
      salonId:         dto.salonId,
      name:            dto.name,
      description:     dto.description ?? null,
      category:        dto.category ?? null,
      price:           dto.price,
      discountPrice:   dto.discountPrice ?? null,
      durationMinutes: dto.durationMinutes ?? 30,
      imageUrl:        dto.imageUrl ?? null,
      isActive:        dto.isActive ?? true,
      sortOrder:       dto.sortOrder ?? 0,
    });

    const saved = await this.serviceRepo.save(service);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.created', category: 'service', entityType: 'service', entityId: saved.id, newValues: { name: saved.name, salonId: saved.salonId, price: saved.price } });
    return ServiceResponseDto.from(saved);
  }

  // ─── Read: list ───────────────────────────────────────────────────────────

  async findAll(
    query: ServiceQueryDto,
    requester?: JwtPayload,
  ): Promise<PaginatedResult<ServiceResponseDto>> {
    const qb = this.serviceRepo
      .createQueryBuilder('service')
      .where('service.deletedAt IS NULL');

    // Public / customers see only active services
    const isPrivileged =
      requester &&
      (requester.role === Role.SUPER_ADMIN ||
        requester.role === Role.ONBOARDING_STAFF ||
        requester.role === Role.SALON_OWNER ||
        requester.role === Role.STAFF);

    if (!isPrivileged) {
      qb.andWhere('service.isActive = :active', { active: true });
    } else if (query.isActive !== undefined) {
      qb.andWhere('service.isActive = :active', { active: query.isActive });
    }

    if (query.salonId) {
      qb.andWhere('service.salonId = :salonId', { salonId: query.salonId });
    }

    if (query.search?.trim()) {
      qb.andWhere('service.name LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.category?.trim()) {
      qb.andWhere('service.category LIKE :category', {
        category: `%${query.category.trim()}%`,
      });
    }

    const sortField = query.sortBy ?? 'sortOrder';
    const sortOrder = query.sortOrder ?? 'ASC';
    qb.orderBy(`service.${sortField}`, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data.map(ServiceResponseDto.from), total, query.page, query.limit);
  }

  // ─── Read: single ─────────────────────────────────────────────────────────

  async findOne(id: string): Promise<ServiceResponseDto> {
    return ServiceResponseDto.from(await this.findEntityOrFail(id));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateServiceDto,
    requester: JwtPayload,
  ): Promise<ServiceResponseDto> {
    const service = await this.findEntityOrFail(id);
    this.assertSalonAccess(service.salonId, requester);

    Object.assign(service, dto);
    const saved = await this.serviceRepo.save(service);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.updated', category: 'service', entityType: 'service', entityId: id, newValues: dto as Record<string, any> });
    return ServiceResponseDto.from(saved);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const service = await this.findEntityOrFail(id);
    this.assertSalonAccess(service.salonId, requester);
    await this.serviceRepo.softRemove(service);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.deleted', category: 'service', entityType: 'service', entityId: id, oldValues: { name: service.name, salonId: service.salonId } });
  }

  // ─── Assign barber to service ─────────────────────────────────────────────

  async assignBarber(
    serviceId: string,
    dto: AssignBarberDto,
    requester: JwtPayload,
  ): Promise<void> {
    const service = await this.findEntityOrFail(serviceId);
    this.assertSalonAccess(service.salonId, requester);

    const existing = await this.barberServiceRepo.findOne({
      where: { barberId: dto.barberId, serviceId },
    });
    if (existing) {
      throw new ConflictException('Barber is already assigned to this service');
    }

    const assignment = this.barberServiceRepo.create({
      barberId:       dto.barberId,
      serviceId,
      customPrice:    dto.customPrice ?? null,
      customDuration: dto.customDuration ?? null,
    });

    await this.barberServiceRepo.save(assignment);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.barber_assigned', category: 'service', entityType: 'service', entityId: serviceId, metadata: { barberId: dto.barberId, customPrice: dto.customPrice, customDuration: dto.customDuration } });
  }

  // ─── Remove barber from service ───────────────────────────────────────────

  async removeBarber(
    serviceId: string,
    barberId: string,
    requester: JwtPayload,
  ): Promise<void> {
    const service = await this.findEntityOrFail(serviceId);
    this.assertSalonAccess(service.salonId, requester);

    const assignment = await this.barberServiceRepo.findOne({
      where: { barberId, serviceId },
    });
    if (!assignment) {
      throw new NotFoundException('Barber is not assigned to this service');
    }

    await this.barberServiceRepo.remove(assignment);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.barber_removed', category: 'service', entityType: 'service', entityId: serviceId, metadata: { barberId } });
  }

  // ─── List barbers for a service ───────────────────────────────────────────

  async findBarbers(serviceId: string): Promise<BarberServiceEntity[]> {
    await this.findEntityOrFail(serviceId); // ensure service exists
    return this.barberServiceRepo.find({
      where: { serviceId },
      relations: ['barber'],
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  async findEntityOrFail(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertSalonAccess(salonId: string, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      requester.role !== Role.SALON_OWNER &&
      requester.role !== Role.STAFF
    ) {
      throw new ForbiddenException('You do not have permission to manage services');
    }
  }
}
