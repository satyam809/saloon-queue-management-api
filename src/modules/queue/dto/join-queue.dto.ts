import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinQueueDto {
  @ApiPropertyOptional({ description: 'Preferred barber UUID — null means any available barber' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({ description: 'Service UUID the customer wants' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ example: 'Haircut + beard trim' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
