import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

/**
 * ActivityLogModule — global append-only audit trail module.
 *
 * Marked `@Global()` so that ActivityLogService is available for injection
 * in every feature module without explicitly importing ActivityLogModule
 * in each of them. Only app.module.ts (or the root module) needs to import
 * this module once.
 *
 * The module registers the ActivityLog entity, provides the service and
 * controller, and exports ActivityLogService for cross-module use.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService],
  controllers: [ActivityLogController],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
