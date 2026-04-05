import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from './entities/queue.entity';
import { QueueEntry } from './entities/queue-entry.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { SalonModule } from '@modules/salon/salon.module';

/**
 * QueueModule encapsulates all queue management features for the salon system.
 *
 * Responsibilities:
 * - Daily queue lifecycle: open, close, force-reset
 * - Customer check-in (join) with atomic token assignment via Redis Lua scripts
 * - Staff-driven status transitions: call next, start service, complete, no-show
 * - Customer self-service: cancel entry, live position polling
 * - Public live state endpoint served from Redis cache (no DB hit on cache hit)
 *
 * Imports SalonModule to access SalonService for capacity checks and
 * average service duration used in EWT (estimated wait time) calculations.
 *
 * Exports QueueService so other modules (e.g. AppointmentModule) can
 * look up active queue entries without duplicating repository logic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, QueueEntry]),
    SalonModule,   // SalonService.findEntityOrFail — capacity + avg duration
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
