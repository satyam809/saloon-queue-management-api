import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /auth/forgot-password.
 * The server always returns the same success response regardless of whether
 * the email is registered, to prevent user enumeration attacks.
 */
export class ForgotPasswordDto {
  /** Email address of the account for which a reset link should be sent. */
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150)
  email: string;
}
