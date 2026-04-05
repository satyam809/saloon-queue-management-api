import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Service } from '../entities/service.entity';

/**
 * Outbound DTO representing a service resource in API responses.
 *
 * Used by all service endpoints (e.g. `GET /services`, `GET /services/:id`,
 * `POST /services`) to serialize {@link Service} entities into a stable,
 * Swagger-documented shape. Decimal columns returned as strings by the
 * MySQL driver (e.g. `price`, `discountPrice`) are coerced to JavaScript
 * `number` via `Number()` in the {@link from} factory method.
 */
export class ServiceResponseDto {
  /** Unique identifier (UUID) of the service record. */
  @ApiProperty() id: string;

  /** UUID of the salon that owns this service. */
  @ApiProperty() salonId: string;

  /** Display name of the service. */
  @ApiProperty() name: string;

  /** Longer description of the service, or `null` if not provided. */
  @ApiPropertyOptional() description: string | null;

  /** Grouping category (e.g. `Hair`, `Beard`), or `null` if not set. */
  @ApiPropertyOptional() category: string | null;

  /** Base price for the service in the salon's configured currency. */
  @ApiProperty() price: number;

  /** Discounted promotional price, or `null` when no discount is active. */
  @ApiPropertyOptional() discountPrice: number | null;

  /** Estimated service duration in minutes. */
  @ApiProperty() durationMinutes: number;

  /** URL of a representative image for the service, or `null` if not set. */
  @ApiPropertyOptional() imageUrl: string | null;

  /** Whether the service is currently available for customer booking. */
  @ApiProperty() isActive: boolean;

  /** Integer controlling the display position in the service catalogue. */
  @ApiProperty() sortOrder: number;

  /** Timestamp when the service record was created. */
  @ApiProperty() createdAt: Date;

  /** Timestamp when the service record was last updated. */
  @ApiProperty() updatedAt: Date;

  /**
   * Factory method that maps a {@link Service} entity to a {@link ServiceResponseDto}.
   *
   * Decimal columns stored as strings by the MySQL driver (`price`,
   * `discountPrice`) are explicitly cast to `number`. A `null` check is
   * performed on `discountPrice` before casting to preserve the semantic
   * difference between "no discount" (`null`) and a zero-price discount.
   *
   * @param service - The service entity retrieved from the database.
   * @returns A fully populated {@link ServiceResponseDto} instance.
   */
  static from(service: Service): ServiceResponseDto {
    const dto            = new ServiceResponseDto();
    dto.id               = service.id;
    dto.salonId          = service.salonId;
    dto.name             = service.name;
    dto.description      = service.description;
    dto.category         = service.category;
    dto.price            = Number(service.price);
    dto.discountPrice    = service.discountPrice !== null ? Number(service.discountPrice) : null;
    dto.durationMinutes  = service.durationMinutes;
    dto.imageUrl         = service.imageUrl;
    dto.isActive         = service.isActive;
    dto.sortOrder        = service.sortOrder;
    dto.createdAt        = service.createdAt;
    dto.updatedAt        = service.updatedAt;
    return dto;
  }
}
