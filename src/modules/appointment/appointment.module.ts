import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';

/**
 * NestJS feature module that encapsulates the appointment domain.
 *
 * Registers the {@link Appointment} TypeORM entity, binds the
 * {@link AppointmentController} to the router, and provides
 * {@link AppointmentService} both internally and to other modules that
 * import this module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
  controllers: [AppointmentController],
  providers: [AppointmentService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
