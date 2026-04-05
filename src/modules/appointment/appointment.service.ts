import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { paginate } from '@shared/utils/pagination.util';
import { AppointmentStatus } from '@common/enums/status.enum';
import { addMinutes, isFuture } from '@shared/utils/date.util';

/**
 * Service responsible for all appointment business logic.
 *
 * Handles creation, retrieval, mutation, and cancellation of appointments,
 * including conflict detection and status-transition validation.
 */
@Injectable()
export class AppointmentService {
  /**
   * Injects the TypeORM {@link Appointment} repository.
   *
   * @param appointmentRepo - Repository used to persist and query appointment records.
   */
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  /**
   * Creates a new appointment for the given customer.
   *
   * Validates that `scheduledAt` is in the future and checks for conflicting
   * CONFIRMED appointments that overlap the requested time slot before persisting.
   *
   * @param dto    - DTO containing salon, staff, timing, and service details.
   * @param userId - UUID of the authenticated customer booking the appointment.
   * @returns The persisted {@link Appointment} entity.
   * @throws {BadRequestException} When `scheduledAt` is in the past.
   * @throws {BadRequestException} When the requested time slot is already booked.
   */
  async create(dto: CreateAppointmentDto, userId: string): Promise<Appointment> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (!isFuture(scheduledAt)) {
      throw new BadRequestException('Appointment must be scheduled in the future');
    }

    const duration = dto.durationMinutes ?? 30;
    const endsAt = addMinutes(scheduledAt, duration);

    const conflict = await this.appointmentRepo.findOne({
      where: {
        salonId: dto.salonId,
        barberId: dto.staffId ?? IsNull(),
        status: AppointmentStatus.CONFIRMED,
        scheduledAt: Between(scheduledAt, endsAt),
      },
    });
    if (conflict) throw new BadRequestException('Time slot already booked');

    const appointment = this.appointmentRepo.create({
      salonId: dto.salonId,
      customerId: userId,
      barberId: dto.staffId ?? null,
      scheduledAt,
      endsAt,
      durationMinutes: duration,
      serviceType: dto.serviceType ?? null,
      notes: dto.notes ?? null,
    });
    return this.appointmentRepo.save(appointment);
  }

  /**
   * Retrieves a paginated list of appointments for a specific customer.
   *
   * Results are ordered by `scheduledAt` descending (newest first).
   *
   * @param userId     - UUID of the customer whose appointments to retrieve.
   * @param pagination - Pagination parameters (`page`, `limit`, `skip`).
   * @returns A paginated result object containing appointment records and metadata.
   */
  async findForUser(userId: string, pagination: PaginationDto) {
    const [data, total] = await this.appointmentRepo.findAndCount({
      where: { customerId: userId },
      skip: pagination.skip,
      take: pagination.limit,
      order: { scheduledAt: 'DESC' },
    });
    return paginate(data, total, pagination.page, pagination.limit);
  }

  /**
   * Retrieves a paginated list of appointments for a specific salon.
   *
   * Results are ordered by `scheduledAt` ascending (earliest first).
   *
   * @param salonId    - UUID of the salon whose appointments to retrieve.
   * @param pagination - Pagination parameters (`page`, `limit`, `skip`).
   * @returns A paginated result object containing appointment records and metadata.
   */
  async findForSalon(salonId: string, pagination: PaginationDto) {
    const [data, total] = await this.appointmentRepo.findAndCount({
      where: { salonId },
      skip: pagination.skip,
      take: pagination.limit,
      order: { scheduledAt: 'ASC' },
    });
    return paginate(data, total, pagination.page, pagination.limit);
  }

  /**
   * Retrieves a single appointment by its primary key.
   *
   * @param id - UUID of the appointment to look up.
   * @returns The matching {@link Appointment} entity.
   * @throws {NotFoundException} When no appointment with the given `id` exists.
   */
  async findOne(id: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  /**
   * Applies a partial update to an existing appointment.
   *
   * Uses `Object.assign` to merge the DTO fields into the entity before saving,
   * so only fields present in `dto` are changed.
   *
   * @param id  - UUID of the appointment to update.
   * @param dto - Partial DTO with the fields to update.
   * @returns The updated and persisted {@link Appointment} entity.
   * @throws {NotFoundException} When no appointment with the given `id` exists.
   */
  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const appt = await this.findOne(id);
    Object.assign(appt, dto);
    return this.appointmentRepo.save(appt);
  }

  /**
   * Cancels an appointment on behalf of the owning customer.
   *
   * Verifies that the appointment belongs to `userId` and that it is in a
   * cancellable state (i.e. not already COMPLETED or CANCELLED).
   *
   * @param id     - UUID of the appointment to cancel.
   * @param userId - UUID of the authenticated customer; must match the appointment's `customerId`.
   * @returns The updated {@link Appointment} entity with status CANCELLED.
   * @throws {NotFoundException} When no appointment matching `id` and `userId` is found.
   * @throws {BadRequestException} When the appointment is already COMPLETED or CANCELLED.
   */
  async cancel(id: string, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({ where: { id, customerId: userId } });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (
      appt.status === AppointmentStatus.COMPLETED ||
      appt.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException('Appointment cannot be cancelled');
    }
    appt.status = AppointmentStatus.CANCELLED;
    return this.appointmentRepo.save(appt);
  }
}
