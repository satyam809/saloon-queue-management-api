import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({
    description:
      'New password — min 8 chars, must include uppercase, lowercase, number, and special character',
    example: 'NewSecret@456',
  })
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/, {
    message:
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;

  @ApiProperty({ description: 'Must match newPassword exactly' })
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
