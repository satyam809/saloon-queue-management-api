import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request body for POST /auth/register.
 * Creates a new CUSTOMER account. Role assignment is not accepted here —
 * admin-created accounts with elevated roles go through POST /users.
 */
export class RegisterDto {
  /** Full display name of the new user. */
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  /** Email address — must be unique across all active accounts. */
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150)
  email: string;

  /**
   * Password for the new account.
   * Must be 8–72 characters and satisfy complexity requirements:
   * at least one uppercase letter, one lowercase letter, one digit,
   * and one special character from [@$!%*?&-_#^()].
   */
  @ApiProperty({
    example: 'Secret@123',
    description:
      'Min 8 chars, must include uppercase, lowercase, number, and special character',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' }) // bcrypt limit
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  /** Optional phone number. Must be unique if provided. */
  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
