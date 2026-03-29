import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/status.enum';

export type UserSortField = 'name' | 'email' | 'createdAt' | 'lastLoginAt';
export type SortOrder = 'ASC' | 'DESC';

export class UserQueryDto extends PaginationDto {
  /**
   * Case-insensitive substring match on name OR email.
   * MySQL utf8mb4_unicode_ci makes LIKE case-insensitive by default.
   */
  @ApiPropertyOptional({
    description: 'Search by name or email (case-insensitive substring)',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'Filter by role. Admins only — non-admins see a scoped subset.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter by account status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: ['name', 'email', 'createdAt', 'lastLoginAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'email', 'createdAt', 'lastLoginAt'])
  sortBy?: UserSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: SortOrder = 'DESC';
}
