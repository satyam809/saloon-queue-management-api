import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from './entities/queue.entity';
import { QueueEntry } from './entities/queue-entry.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { SalonModule } from '@modules/salon/salon.module';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, QueueEntry]), SalonModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
