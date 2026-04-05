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

/**
 * Business-logic service for the **Service** resource.
 *
 * Provides full CRUD operations on salon services as well as the ability
 * to assign and remove barbers from individual services (the
 * `barber_service` join table). Every mutating operation:
 * 1. Validates that the requester is authorised to modify the target salon
 *    via {@link assertSalonAccess}.
 * 2. Records an entry in the activity log through {@link ActivityLogService}.
 *
 * This class is registered as an NestJS `@Injectable()` provider and should
 * be injected via the module's dependency-injection container.
 */
@Injectable()
export class ServiceService {
  /**
   * @param serviceRepo      - TypeORM repository for the {@link Service} entity.
   * @param barberServiceRepo - TypeORM repository for the {@link BarberServiceEntity}
   *                            join table between barbers and services.
   * @param actLog           - Activity log service used to record audit events.
   */
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(BarberServiceEntity)
    private readonly barberServiceRepo: Repository<BarberServiceEntity>,
    private readonly actLog: ActivityLogService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a new service for a salon.
   *
   * Corresponds to `POST /services`.
   *
   * Access is restricted to `SUPER_ADMIN`, `SALON_OWNER`, and `STAFF` roles
   * (enforced by {@link assertSalonAccess}). An activity-log entry with action
   * `service.created` is written asynchronously after the record is persisted.
   *
   * @param dto       - Validated payload containing the new service's details.
   * @param requester - JWT payload of the authenticated caller.
   * @returns The newly created service serialized as a {@link ServiceResponseDto}.
   * @throws {ForbiddenException} When the requester lacks permission to manage
   *   services for the target salon.
   */
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

  /**
   * Returns a paginated, filtered list of services.
   *
   * Corresponds to `GET /services`.
   *
   * Unprivileged callers (customers and unauthenticated requests) are silently
   * restricted to active services only (`isActive = true`). Privileged roles
   * (`SUPER_ADMIN`, `ONBOARDING_STAFF`, `SALON_OWNER`, `STAFF`) may filter by
   * `isActive` freely or omit the filter to see all services.
   *
   * @param query     - Validated query parameters including filters, sort, and pagination.
   * @param requester - Optional JWT payload of the authenticated caller. When absent
   *                    the caller is treated as unprivileged.
   * @returns A {@link PaginatedResult} containing matching services as
   *   {@link ServiceResponseDto} objects.
   */
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

  /**
   * Retrieves a single service by its UUID.
   *
   * Corresponds to `GET /services/:id`.
   *
   * @param id - UUID of the service to retrieve.
   * @returns The matching service serialized as a {@link ServiceResponseDto}.
   * @throws {NotFoundException} When no service with the given `id` exists.
   */
  async findOne(id: string): Promise<ServiceResponseDto> {
    return ServiceResponseDto.from(await this.findEntityOrFail(id));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Partially or fully updates an existing service.
   *
   * Corresponds to `PATCH /services/:id`.
   *
   * Access is restricted to `SUPER_ADMIN`, `SALON_OWNER`, and `STAFF` roles.
   * An activity-log entry with action `service.updated` is written
   * asynchronously after the record is persisted.
   *
   * @param id        - UUID of the service to update.
   * @param dto       - Validated payload containing the fields to update.
   * @param requester - JWT payload of the authenticated caller.
   * @returns The updated service serialized as a {@link ServiceResponseDto}.
   * @throws {NotFoundException}  When no service with the given `id` exists.
   * @throws {ForbiddenException} When the requester lacks permission to manage
   *   services for the target salon.
   */
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

  /**
   * Soft-deletes a service by setting its `deletedAt` timestamp.
   *
   * Corresponds to `DELETE /services/:id`.
   *
   * Access is restricted to `SUPER_ADMIN`, `SALON_OWNER`, and `STAFF` roles.
   * An activity-log entry with action `service.deleted` is written
   * asynchronously after the record is removed.
   *
   * @param id        - UUID of the service to delete.
   * @param requester - JWT payload of the authenticated caller.
   * @throws {NotFoundException}  When no service with the given `id` exists.
   * @throws {ForbiddenException} When the requester lacks permission to manage
   *   services for the target salon.
   */
  async remove(id: string, requester: JwtPayload): Promise<void> {
    const service = await this.findEntityOrFail(id);
    this.assertSalonAccess(service.salonId, requester);
    await this.serviceRepo.softRemove(service);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'service.deleted', category: 'service', entityType: 'service', entityId: id, oldValues: { name: service.name, salonId: service.salonId } });
  }

  // ─── Assign barber to service ─────────────────────────────────────────────

  /**
   * Assigns a barber to a service, optionally with custom price and duration.
   *
   * Corresponds to `POST /services/:id/barbers`.
   *
   * Creates a record in the `barber_service` join table. If the barber is
   * already assigned to the service a `409 Conflict` is thrown. An
   * activity-log entry with action `service.barber_assigned` is written
   * asynchronously after the assignment is saved.
   *
   * @param serviceId - UUID of the service to which the barber will be assigned.
   * @param dto       - Validated payload containing the barber UUID and optional overrides.
   * @param requester - JWT payload of the authenticated caller.
   * @throws {NotFoundException}   When no service with `serviceId` exists.
   * @throws {ConflictException}   When the barber is already assigned to the service.
   * @throws {ForbiddenException}  When the requester lacks permission to manage
   *   services for the target salon.
   */
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

  /**
   * Removes the assignment between a barber and a service.
   *
   * Corresponds to `DELETE /services/:id/barbers/:barberId`.
   *
   * Deletes the matching record from the `barber_service` join table. An
   * activity-log entry with action `service.barber_removed` is written
   * asynchronously after the record is deleted.
   *
   * @param serviceId - UUID of the service from which the barber will be removed.
   * @param barberId  - UUID of the barber to remove from the service.
   * @param requester - JWT payload of the authenticated caller.
   * @throws {NotFoundException}  When the service does not exist or the barber
   *   is not currently assigned to the service.
   * @throws {ForbiddenException} When the requester lacks permission to manage
   *   services for the target salon.
   */
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

  /**
   * Returns all barber assignments for the given service, with their
   * associated barber entity eagerly loaded.
   *
   * Corresponds to `GET /services/:id/barbers`.
   *
   * @param serviceId - UUID of the service whose barbers should be listed.
   * @returns An array of {@link BarberServiceEntity} records with the
   *   `barber` relation populated.
   * @throws {NotFoundException} When no service with `serviceId` exists.
   */
  async findBarbers(serviceId: string): Promise<BarberServiceEntity[]> {
    await this.findEntityOrFail(serviceId); // ensure service exists
    return this.barberServiceRepo.find({
      where: { serviceId },
      relations: ['barber'],
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Loads a {@link Service} entity by its UUID or throws a 404 if absent.
   *
   * Intended for internal reuse across service methods and can also be
   * called by external services (e.g. the appointment service) that need
   * to validate that a service record exists before proceeding.
   *
   * @param id - UUID of the service to load.
   * @returns The matching {@link Service} entity.
   * @throws {NotFoundException} When no service with the given `id` exists.
   */
  async findEntityOrFail(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Asserts that the requester has permission to create, update, or delete
   * services within the given salon.
   *
   * `SUPER_ADMIN` callers pass unconditionally. `SALON_OWNER` and `STAFF`
   * are permitted. All other roles receive a `403 Forbidden` response.
   *
   * @param salonId   - UUID of the salon being accessed (currently unused in
   *                    the check but kept for future ownership validation).
   * @param requester - JWT payload of the authenticated caller.
   * @throws {ForbiddenException} When the requester's role is neither
   *   `SUPER_ADMIN`, `SALON_OWNER`, nor `STAFF`.
   */
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
