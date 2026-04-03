import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

export class ReviewQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by barber UUID' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({ description: 'Filter by exact rating (1–5)', minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Only return reviews with a proven visit' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVerifiedVisit?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by published status (admin only — public always sees published reviews)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: ['rating', 'createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['rating', 'createdAt'])
  sortBy?: 'rating' | 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
