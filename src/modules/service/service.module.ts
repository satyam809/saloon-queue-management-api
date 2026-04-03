import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { BarberService as BarberServiceEntity } from './entities/barber-service.entity';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Service, BarberServiceEntity])],
  controllers: [ServiceController],
  providers: [ServiceService],
  /**
   * Export ServiceService so QueueModule, AppointmentModule etc.
   * can call findEntityOrFail() for FK validation without circular imports.
   */
  exports: [ServiceService],
})
export class ServiceModule {}
