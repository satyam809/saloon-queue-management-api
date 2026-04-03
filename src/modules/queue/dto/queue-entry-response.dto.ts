import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueStatus } from '@common/enums/status.enum';
import { QueueEntry } from '../entities/queue-entry.entity';

export class QueueEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() queueId: string;
  @ApiProperty() customerId: string;
  @ApiPropertyOptional() barberId: string | null;
  @ApiPropertyOptional() serviceId: string | null;
  @ApiProperty() tokenNumber: number;
  @ApiProperty() tokenDisplay: string;          // e.g. "A-007"
  @ApiProperty() position: number;              // position at check-in
  @ApiProperty({ enum: QueueStatus }) status: QueueStatus;
  @ApiPropertyOptional() estimatedWaitMinutes: number | null;
  @ApiPropertyOptional() notes: string | null;
  @ApiProperty() checkedInAt: Date;
  @ApiPropertyOptional() calledAt: Date | null;
  @ApiPropertyOptional() serviceStartedAt: Date | null;
  @ApiPropertyOptional() completedAt: Date | null;
  @ApiPropertyOptional() cancelledAt: Date | null;
  @ApiPropertyOptional() cancellationReason: string | null;

  static from(entry: QueueEntry): QueueEntryResponseDto {
    const dto                  = new QueueEntryResponseDto();
    dto.id                     = entry.id;
    dto.queueId                = entry.queueId;
    dto.customerId             = entry.customerId;
    dto.barberId               = entry.barberId;
    dto.serviceId              = entry.serviceId;
    dto.tokenNumber            = entry.tokenNumber;
    dto.tokenDisplay           = `A-${String(entry.tokenNumber).padStart(3, '0')}`;
    dto.position               = entry.position;
    dto.status                 = entry.status;
    dto.estimatedWaitMinutes   = entry.estimatedWaitMinutes;
    dto.notes                  = entry.notes;
    dto.checkedInAt            = entry.checkedInAt;
    dto.calledAt               = entry.calledAt;
    dto.serviceStartedAt       = entry.serviceStartedAt;
    dto.completedAt            = entry.completedAt;
    dto.cancelledAt            = entry.cancelledAt;
    dto.cancellationReason     = entry.cancellationReason;
    return dto;
  }
}
