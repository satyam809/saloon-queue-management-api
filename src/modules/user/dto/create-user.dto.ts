import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

/**
 * Data Transfer Object for creating a new user account.
 *
 * Carries all fields required (or optionally provided) when registering
 * a new user through the `POST /users` endpoint. Validation is enforced
 * via `class-validator` decorators and API metadata is exposed through
 * `@nestjs/swagger` decorators.
 */
export class CreateUserDto {
  /**
   * Full display name of the user.
   *
   * @example 'Jane Doe'
   */
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  /**
   * Unique email address used for authentication and communication.
   *
   * @example 'jane@example.com'
   */
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Provide a valid email address' })
  @MaxLength(150)
  email: string;

  /**
   * Plain-text password that will be hashed before persistence.
   *
   * Requirements: minimum 8 characters, maximum 72 characters (bcrypt limit),
   * must contain at least one uppercase letter, one lowercase letter, one digit,
   * and one special character.
   *
   * @example 'Secret@123'
   */
  @ApiProperty({
    example: 'Secret@123',
    description:
      'Min 8 chars. Must contain uppercase, lowercase, number, and special character. ' +
      'Max 72 chars (bcrypt limit).',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/, {
    message:
      'Password must contain at least one uppercase letter, lowercase letter, number, and special character',
  })
  password: string;

  /**
   * Optional contact phone number for the user.
   * Must be a valid E.164-style string (e.g. `+1234567890`).
   *
   * @example '+1234567890'
   */
  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /**
   * Role to assign to the new user.
   *
   * Defaults to `CUSTOMER` when omitted. Only a `SUPER_ADMIN` caller
   * should assign elevated roles such as `SALON_OWNER` or `STAFF`.
   *
   * @default Role.CUSTOMER
   */
  @ApiPropertyOptional({
    enum: Role,
    default: Role.CUSTOMER,
    description: 'Defaults to CUSTOMER. Only SUPER_ADMIN can assign elevated roles.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
