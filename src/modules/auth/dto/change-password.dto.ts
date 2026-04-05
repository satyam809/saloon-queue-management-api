import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /auth/change-password.
 * All three fields are required. The service validates that currentPassword
 * matches the stored hash and that newPassword differs from the current one.
 */
export class ChangePasswordDto {
  /** The user's existing password, used to confirm identity before changing. */
  @ApiProperty({ description: 'Current account password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  /**
   * The desired new password.
   * Must be 8–72 characters and include at least one uppercase letter,
   * one lowercase letter, one digit, and one special character.
   */
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

  /** Confirmation value — must match newPassword exactly. */
  @ApiProperty({ description: 'Must match newPassword exactly' })
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
