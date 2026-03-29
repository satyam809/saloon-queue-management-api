import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { SalonStatus } from '@common/enums/status.enum';

export class SalonQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: SalonStatus, description: 'Filter by salon status' })
  @IsOptional()
  @IsIn(Object.values(SalonStatus))
  status?: SalonStatus;

  @ApiPropertyOptional({ description: 'Filter by city name (exact, case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    enum: ['name', 'city', 'createdAt', 'verifiedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'city', 'createdAt', 'verifiedAt'])
  sortBy?: 'name' | 'city' | 'createdAt' | 'verifiedAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
