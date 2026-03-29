import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQueueDto {
  @ApiProperty({ example: 'uuid-of-salon' })
  @IsUUID()
  salonId: string;

  @ApiProperty({ example: '2026-03-29' })
  @IsNotEmpty()
  @IsDateString()
  date: string;
}
