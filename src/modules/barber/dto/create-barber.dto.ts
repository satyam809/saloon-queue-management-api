import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new barber profile.
 *
 * Used by the `POST /barbers` endpoint. The `salonId` and `name` fields
 * are required; all other fields are optional. A barber may optionally be
 * linked to an existing user account via `userId`.
 */
export class CreateBarberDto {
  /**
   * Display name of the barber as it will appear to customers.
   *
   * @example 'John Doe'
   */
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  /**
   * UUID of the salon that this barber profile belongs to.
   *
   * @example 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   */
  @ApiProperty({ description: 'UUID of the salon this barber belongs to' })
  @IsUUID()
  salonId: string;

  /**
   * UUID of an existing user account to link to this barber profile.
   *
   * When provided, the barber can authenticate using their user credentials.
   * Omit for barbers who do not have a platform account.
   */
  @ApiPropertyOptional({ description: 'Link to an existing user account (optional)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Short biography or professional description shown on the barber's profile.
   *
   * @example 'Specialist in fades and beard trims.'
   */
  @ApiPropertyOptional({ example: 'Specialist in fades and beard trims.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  /**
   * Publicly accessible URL of the barber's profile avatar image.
   *
   * @example 'https://cdn.example.com/avatar.jpg'
   */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  /**
   * Contact email address for the barber.
   *
   * @example 'john@example.com'
   */
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  /**
   * Contact phone number for the barber in E.164 format.
   *
   * @example '+12125551234'
   */
  @ApiPropertyOptional({ example: '+12125551234' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  /**
   * List of free-form skill tags describing the barber's specializations.
   *
   * Each element must be a non-empty string. Used for filtering and
   * display purposes on the barber's profile.
   *
   * @example ['haircut', 'beard trim', 'coloring']
   */
  @ApiPropertyOptional({
    example: ['haircut', 'beard trim', 'coloring'],
    description: 'Free-form skill tags',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];
}
