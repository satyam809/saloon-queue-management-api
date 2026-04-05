import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new salon service.
 *
 * Used by the `POST /services` endpoint. The `salonId`, `name`, and `price`
 * fields are required. Optional fields such as `discountPrice`,
 * `durationMinutes`, and `imageUrl` allow richer service catalogues.
 */
export class CreateServiceDto {
  /**
   * UUID of the salon that will own this service.
   *
   * @example 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
   */
  @ApiProperty({ description: 'UUID of the salon this service belongs to' })
  @IsUUID()
  salonId: string;

  /**
   * Human-readable name for the service shown to customers.
   *
   * Must be between 2 and 150 characters.
   *
   * @example 'Classic Haircut'
   */
  @ApiProperty({ example: 'Classic Haircut' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  /**
   * Longer description of what the service entails.
   * Maximum 2000 characters.
   *
   * @example 'A clean, precise cut for any style.'
   */
  @ApiPropertyOptional({ example: 'A clean, precise cut for any style.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /**
   * Grouping category for the service (e.g. `Hair`, `Beard`, `Skin`).
   * Used for filtering and display grouping in the service catalogue.
   * Maximum 80 characters.
   *
   * @example 'Hair'
   */
  @ApiPropertyOptional({ example: 'Hair', description: 'Service category (e.g. Hair, Beard, Skin)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  /**
   * Base price for the service in the salon's configured currency.
   * Must be a positive number with at most two decimal places.
   *
   * @example 25.00
   */
  @ApiProperty({ example: 25.00, description: 'Base price in the salon currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  /**
   * Optional discounted (promotional) price for the service.
   *
   * When set, this value should be presented to customers in place of
   * or alongside `price`. Set to `null` to disable any active discount.
   *
   * @example 18.00
   */
  @ApiPropertyOptional({ example: 18.00, description: 'Discounted price — null to disable discount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  discountPrice?: number;

  /**
   * Estimated duration of the service in minutes.
   *
   * Valid range is 5–480 minutes. Defaults to `30` when omitted.
   *
   * @default 30
   * @example 30
   */
  @ApiPropertyOptional({ example: 30, description: 'Service duration in minutes', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  /**
   * Publicly accessible URL of an image representing the service.
   *
   * @example 'https://cdn.example.com/haircut.jpg'
   */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/haircut.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  /**
   * Whether the service is currently available for booking by customers.
   *
   * Defaults to `true` when omitted. Staff and owners can deactivate a
   * service without deleting it by setting this to `false`.
   *
   * @default true
   * @example true
   */
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Integer used to control the display order of services in the catalogue.
   *
   * Lower values appear first. Defaults to `0` when omitted.
   *
   * @default 0
   * @example 0
   */
  @ApiPropertyOptional({ example: 0, description: 'Display sort order', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
