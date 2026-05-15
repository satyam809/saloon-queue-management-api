import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { CreateSalonDto } from './create-salon.dto';

/**
 * Owner account details supplied when a new user self-registers as SALON_OWNER
 * through the POST /salons endpoint.
 */
export class SalonOwnerDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150)
  email!: string;

  @ApiProperty({
    example: 'Secret@123',
    description:
      'Min 8 chars — uppercase, lowercase, number, and special character required',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

/**
 * Request body for POST /salons when used as a self-registration flow.
 *
 * Extends {@link CreateSalonDto} with an optional nested `owner` object.
 * When `owner` is present the endpoint operates in registration mode:
 * it creates the SALON_OWNER user account and the salon in one request,
 * then returns auth tokens alongside the salon record.
 * When `owner` is absent the caller must already be authenticated.
 */
export class RegisterSalonDto extends CreateSalonDto {
  @ApiPropertyOptional({
    type: SalonOwnerDto,
    description:
      'Provide to self-register as a new SALON_OWNER. Omit if already authenticated.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalonOwnerDto)
  owner?: SalonOwnerDto;
}
