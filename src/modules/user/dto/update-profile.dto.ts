import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Fields any authenticated user can update on their own profile.
 * Role, status, and email are intentionally excluded —
 * those require admin action via AdminUpdateUserDto.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/jane.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'OldP@ssword1', description: 'Current password — required when changing password' })
  @ValidateIf((o) => o.newPassword !== undefined)
  @IsString()
  @MinLength(1)
  currentPassword?: string;

  @ApiPropertyOptional({ example: 'NewP@ssword1', description: 'New password — requires currentPassword to be provided' })
  @ValidateIf((o) => o.currentPassword !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword?: string;
}
