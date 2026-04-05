import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /auth/reset-password.
 * The reset token is consumed on first use (single-use, 10-minute TTL)
 * and all active sessions are revoked after a successful reset.
 */
export class ResetPasswordDto {
  /**
   * One-time reset token received via email.
   * Generated as a 32-byte random hex string and stored in Redis with a 10-minute TTL.
   */
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsNotEmpty()
  @IsString()
  token: string;

  /**
   * The new password to set for the account.
   * Must be 8–72 characters and satisfy complexity requirements:
   * at least one uppercase letter, one lowercase letter, one digit,
   * and one special character.
   */
  @ApiProperty({
    description: 'New password',
    example: 'NewSecret@456',
  })
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;

  /** Confirmation value — must match newPassword exactly. */
  @ApiProperty({ description: 'Must match newPassword exactly' })
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
