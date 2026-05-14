import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Salon } from './entities/salon.entity';
import { SalonService } from './salon.service';
import { SalonController } from './salon.controller';
import { UploadModule } from '@modules/upload/upload.module';

/**
 * Feature module that encapsulates all salon-related functionality.
 *
 * Registers the {@link Salon} entity with TypeORM, exposes the REST
 * controller, and exports {@link SalonService} so that other modules
 * (e.g. BarberModule, QueueModule) can resolve salon entities without
 * introducing circular imports.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Salon]), UploadModule],
  controllers: [SalonController],
  providers: [SalonService],
  exports: [SalonService],
})
export class SalonModule {}
