import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * AnalyticsModule — provides revenue, customer-trends, and salon-performance
 * reporting endpoints.
 *
 * Does not own any TypeORM entities; all data is read via raw SQL queries
 * issued through the shared DataSource. Results are cached in Redis for
 * 15 minutes by AnalyticsService to reduce database load.
 */
@Module({
  controllers: [AnalyticsController],
  providers:   [AnalyticsService],
})
export class AnalyticsModule {}
