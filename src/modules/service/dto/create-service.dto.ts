import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'UUID of the salon this service belongs to' })
  @IsUUID()
  salonId: string;

  @ApiProperty({ example: 'Classic Haircut' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'A clean, precise cut for any style.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Hair', description: 'Service category (e.g. Hair, Beard, Skin)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ example: 25.00, description: 'Base price in the salon currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 18.00, description: 'Discounted price — null to disable discount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  discountPrice?: number;

  @ApiPropertyOptional({ example: 30, description: 'Service duration in minutes', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/haircut.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Display sort order', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
