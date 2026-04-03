import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'UUID of the salon being reviewed' })
  @IsUUID()
  salonId: string;

  @ApiProperty({ description: 'Rating from 1 (worst) to 5 (best)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Great haircut!', maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: 'The barber was very professional and precise.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  @ApiPropertyOptional({ description: 'Optional barber-level rating — UUID of the barber' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({ description: 'Queue entry UUID — proves the customer visited (verified review)' })
  @IsOptional()
  @IsUUID()
  queueEntryId?: string;

  @ApiPropertyOptional({ description: 'Appointment UUID — proves the customer visited (verified review)' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}
