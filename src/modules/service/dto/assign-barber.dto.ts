import { IsNumber, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignBarberDto {
  @ApiProperty({ description: 'UUID of the barber to assign to this service' })
  @IsUUID()
  barberId: string;

  @ApiPropertyOptional({
    example: 20.00,
    description: 'Custom price for this barber — overrides service.price when set',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  customPrice?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Custom duration (minutes) for this barber — overrides service.durationMinutes when set',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(480)
  customDuration?: number;
}
