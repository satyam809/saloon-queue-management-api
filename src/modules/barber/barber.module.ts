import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barber } from './entities/barber.entity';
import { BarberService } from './barber.service';
import { BarberController } from './barber.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Barber])],
  controllers: [BarberController],
  providers: [BarberService],
  /**
   * Export BarberService so QueueModule, AppointmentModule etc.
   * can call findEntityOrFail() for FK validation without circular imports.
   */
  exports: [BarberService],
})
export class BarberModule {}
