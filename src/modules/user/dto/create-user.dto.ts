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

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Provide a valid email address' })
  @MaxLength(150)
  email: string;

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

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.CUSTOMER,
    description: 'Defaults to CUSTOMER. Only SUPER_ADMIN can assign elevated roles.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
