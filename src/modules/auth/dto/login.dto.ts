import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /auth/login.
 * Validated by LocalStrategy before the controller handler runs.
 */
export class LoginDto {
  /** Registered email address of the user. */
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150)
  email: string;

  /**
   * Account password. Maximum 72 characters — bcrypt silently truncates
   * anything beyond that limit, so longer inputs could produce false positives.
   */
  @ApiProperty({ example: 'Secret@123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)  // bcrypt silently truncates beyond 72 bytes
  password: string;
}
