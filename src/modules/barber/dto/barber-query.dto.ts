import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';
import { BarberStatus } from '@common/enums/status.enum';

export class BarberQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  @ApiPropertyOptional({ description: 'Search by name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: BarberStatus })
  @IsOptional()
  @IsIn(Object.values(BarberStatus))
  status?: BarberStatus;

  @ApiPropertyOptional({ description: 'Filter by availability' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ enum: ['name', 'rating', 'createdAt'], default: 'name' })
  @IsOptional()
  @IsIn(['name', 'rating', 'createdAt'])
  sortBy?: 'name' | 'rating' | 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
