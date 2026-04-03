import { ApiProperty } from '@nestjs/swagger';

export class QueueMetricDto {
  @ApiProperty({ example: '2026-03-15' }) date: string;
  @ApiProperty({ example: 1 })            totalQueues: number;
  @ApiProperty({ example: 38 })           totalServed: number;
  @ApiProperty({ example: 4 })            totalCancelled: number;
  @ApiProperty({ example: 2 })            totalNoShows: number;
  @ApiProperty({ example: 12.5 })         avgWaitMinutes: number;
  @ApiProperty({ example: 25.3 })         avgServiceMinutes: number;
  /** (total entries / max_queue_size) × 100 */
  @ApiProperty({ example: 88.0 })         utilizationRate: number;
}

export class BarberPerformanceDto {
  @ApiProperty() barberId: string;
  @ApiProperty() barberName: string;
  @ApiProperty({ example: 142 })   totalServed: number;
  @ApiProperty({ example: 24.8 })  avgServiceMinutes: number;
  @ApiProperty({ example: 4.6 })   avgRating: number;
  @ApiProperty({ example: 4260.0 }) revenue: number;
}

export class ServicePopularityDto {
  @ApiProperty() serviceId: string;
  @ApiProperty() serviceName: string;
  @ApiProperty({ example: 210 })   bookingCount: number;
  @ApiProperty({ example: 6300.0 }) revenue: number;
  @ApiProperty({ example: 4.4 })   avgRating: number;
}

export class SalonPerformanceDto {
  @ApiProperty({ example: 520 })                       totalServed: number;
  /** Percentage of all entries that were cancelled */
  @ApiProperty({ example: 7.5 })                       cancellationRate: number;
  /** Percentage of all entries that were no-shows */
  @ApiProperty({ example: 3.2 })                       noShowRate: number;
  @ApiProperty({ example: 11.8 })                      avgWaitMinutes: number;
  @ApiProperty({ example: 26.1 })                      avgServiceMinutes: number;
  @ApiProperty({ type: [QueueMetricDto] })              queueMetrics: QueueMetricDto[];
  /** Only populated when salonId is provided */
  @ApiProperty({ type: [BarberPerformanceDto] })        barberPerformance: BarberPerformanceDto[];
  /** Only populated when salonId is provided */
  @ApiProperty({ type: [ServicePopularityDto] })        servicePopularity: ServicePopularityDto[];
}
