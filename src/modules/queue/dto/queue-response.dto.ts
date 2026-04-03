import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Queue } from '../entities/queue.entity';

export class QueueResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() salonId: string;
  @ApiProperty() date: string;
  @ApiProperty() isOpen: boolean;
  @ApiPropertyOptional() openedAt: Date | null;
  @ApiPropertyOptional() closedAt: Date | null;
  @ApiProperty() currentServingPosition: number;
  @ApiProperty() totalServed: number;
  @ApiProperty() createdAt: Date;

  static from(queue: Queue): QueueResponseDto {
    const dto                     = new QueueResponseDto();
    dto.id                        = queue.id;
    dto.salonId                   = queue.salonId;
    dto.date                      = queue.date;
    dto.isOpen                    = queue.isOpen;
    dto.openedAt                  = queue.openedAt;
    dto.closedAt                  = queue.closedAt;
    dto.currentServingPosition    = queue.currentServingPosition;
    dto.totalServed               = queue.totalServed;
    dto.createdAt                 = queue.createdAt;
    return dto;
  }
}
