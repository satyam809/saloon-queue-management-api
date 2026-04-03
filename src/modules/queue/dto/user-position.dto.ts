import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueStatus } from '@common/enums/status.enum';

export class UserPositionDto {
  @ApiProperty() entryId: string;
  @ApiProperty() tokenNumber: number;
  @ApiProperty() tokenDisplay: string;
  @ApiProperty({ enum: QueueStatus }) status: QueueStatus;
  @ApiProperty({ description: 'Live position in the waiting line (1-based). null when not waiting.' })
  livePosition: number | null;
  @ApiProperty({ description: 'Current number of people ahead' })
  peopleAhead: number | null;
  @ApiProperty({ description: 'Estimated wait in minutes based on live position' })
  estimatedWaitMinutes: number | null;
}
