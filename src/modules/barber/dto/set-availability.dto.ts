import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetAvailabilityDto {
  @ApiProperty({
    example: true,
    description: 'true = barber is available to accept customers; false = unavailable',
  })
  @IsBoolean()
  isAvailable: boolean;
}
