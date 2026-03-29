import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { paginate } from '@shared/utils/pagination.util';
import { AppointmentStatus } from '@common/enums/status.enum';
import { addMinutes, isFuture } from '@shared/utils/date.util';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

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
        staffId: dto.staffId,
        status: AppointmentStatus.CONFIRMED,
        scheduledAt: Between(scheduledAt, endsAt),
      },
    });
    if (conflict) throw new BadRequestException('Time slot already booked');

    const appointment = this.appointmentRepo.create({
      ...dto,
      scheduledAt,
      userId,
    });
    return this.appointmentRepo.save(appointment);
  }

  async findForUser(userId: string, pagination: PaginationDto) {
    const [data, total] = await this.appointmentRepo.findAndCount({
      where: { userId },
      skip: pagination.skip,
      take: pagination.limit,
      order: { scheduledAt: 'DESC' },
    });
    return paginate(data, total, pagination.page, pagination.limit);
  }

  async findForSalon(salonId: string, pagination: PaginationDto) {
    const [data, total] = await this.appointmentRepo.findAndCount({
      where: { salonId },
      skip: pagination.skip,
      take: pagination.limit,
      order: { scheduledAt: 'ASC' },
    });
    return paginate(data, total, pagination.page, pagination.limit);
  }

  async findOne(id: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const appt = await this.findOne(id);
    Object.assign(appt, dto);
    return this.appointmentRepo.save(appt);
  }

  async cancel(id: string, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({ where: { id, userId } });
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
