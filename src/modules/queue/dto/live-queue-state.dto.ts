import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Lightweight snapshot returned by the public live-status endpoint.
 * Built from Redis cache — no DB hit on cache hit.
 */
export class LiveQueueStateDto {
  @ApiProperty() queueId: string;
  @ApiProperty() salonId: string;
  @ApiProperty() date: string;
  @ApiProperty() isOpen: boolean;
  @ApiProperty({ description: 'Number of customers currently waiting' })
  waitingCount: number;
  @ApiProperty({ description: 'Token number currently being served (0 = none yet)' })
  currentServingToken: number;
  @ApiProperty({ description: 'Estimated wait for a new customer joining now (minutes)' })
  estimatedWaitForNewJoin: number;
  @ApiPropertyOptional({ description: 'Rolling average service duration (minutes)' })
  avgServiceDurationMinutes: number;
}
