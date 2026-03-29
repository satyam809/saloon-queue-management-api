import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/status.enum';
import type { User } from '../entities/user.entity';

/**
 * Safe public representation of a User.
 * passwordHash is intentionally absent — never expose it outside the service layer.
 *
 * The static `from()` factory is the only place that maps entity → response,
 * making it impossible to accidentally include a field you didn't intend to.
 */
export class UserResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '+1234567890', nullable: true })
  phone: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  emailVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  phoneVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static from(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id            = user.id;
    dto.name          = user.name;
    dto.email         = user.email;
    dto.phone         = user.phone;
    dto.role          = user.role;
    dto.status        = user.status;
    dto.avatarUrl     = user.avatarUrl;
    dto.emailVerifiedAt  = user.emailVerifiedAt;
    dto.phoneVerifiedAt  = user.phoneVerifiedAt;
    dto.lastLoginAt   = user.lastLoginAt;
    dto.createdAt     = user.createdAt;
    dto.updatedAt     = user.updatedAt;
    return dto;
  }
}
