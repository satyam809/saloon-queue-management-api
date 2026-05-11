import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalonStatus } from '@common/enums/status.enum';
import { Role } from '@common/enums/role.enum';
import { Salon } from '../entities/salon.entity';

export class OwnerDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional() phone: string | null;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty({ enum: Role }) role: Role;
}

/**
 * Outbound DTO representing a salon resource in API responses.
 *
 * Used by all salon endpoints (e.g. `GET /salons`, `GET /salons/:id`,
 * `POST /salons`) to serialize {@link Salon} entities into a stable,
 * Swagger-documented shape. The {@link from} factory method handles the
 * mapping from entity to DTO without altering any values.
 */
export class SalonResponseDto {
  /** Unique identifier (UUID) of the salon record. */
  @ApiProperty() id: string;

  /** UUID of the user who added/registered this salon. */
  @ApiProperty() addedById: string;

  /** Details of the user who added this salon. Null when the relation was not loaded. */
  @ApiPropertyOptional({ type: OwnerDto }) addedBy: OwnerDto | null;

  /**
   * UUID of the staff member who verified the salon during onboarding,
   * or `null` if the salon has not yet been verified.
   */
  @ApiPropertyOptional() verifiedBy: string | null;

  /** Public display name of the salon. */
  @ApiProperty() name: string;

  /** URL-friendly slug derived from the salon name (unique across the platform). */
  @ApiProperty() slug: string;

  /** Optional longer description of the salon shown on its public profile. */
  @ApiPropertyOptional() description: string | null;

  // Location

  /** Street address of the salon, or `null` if not provided. */
  @ApiPropertyOptional() address: string | null;

  /** City in which the salon is located, or `null` if not provided. */
  @ApiPropertyOptional() city: string | null;

  /** State or province in which the salon is located, or `null` if not provided. */
  @ApiPropertyOptional() state: string | null;

  /** Country in which the salon is located. */
  @ApiProperty() country: string;

  /** Postal/ZIP code of the salon's location, or `null` if not provided. */
  @ApiPropertyOptional() postalCode: string | null;

  /** Geographic latitude of the salon, or `null` if not set. */
  @ApiPropertyOptional() latitude: number | null;

  /** Geographic longitude of the salon, or `null` if not set. */
  @ApiPropertyOptional() longitude: number | null;

  // Contact

  /** Contact phone number for the salon, or `null` if not provided. */
  @ApiPropertyOptional() phone: string | null;

  /** Contact email address for the salon, or `null` if not provided. */
  @ApiPropertyOptional() email: string | null;

  // Media

  /** URL of the salon's logo image, or `null` if not uploaded. */
  @ApiPropertyOptional() logoUrl: string | null;

  /** URL of the salon's cover/banner image, or `null` if not uploaded. */
  @ApiPropertyOptional() coverImageUrl: string | null;

  // Business config

  /** Current operational status of the salon (e.g. `PENDING`, `ACTIVE`, `REJECTED`). */
  @ApiProperty({ enum: SalonStatus }) status: SalonStatus;

  /** Whether the salon has been verified by an onboarding staff member. */
  @ApiProperty() isVerified: boolean;

  /** Timestamp when the salon was verified, or `null` if not yet verified. */
  @ApiPropertyOptional() verifiedAt: Date | null;

  /**
   * Reason provided when a salon's onboarding application was rejected,
   * or `null` if the salon was not rejected.
   */
  @ApiPropertyOptional() rejectionReason: string | null;

  /**
   * Average duration (in minutes) across all services offered by this salon.
   * Used for queue time estimation.
   */
  @ApiProperty() avgServiceDurationMinutes: number;

  /** Maximum number of customers allowed in the queue at any one time. */
  @ApiProperty() maxQueueSize: number;

  /**
   * Per-day working hours for the salon.
   *
   * Keys are lowercase day names (e.g. `'monday'`). Each value is either
   * an object with `open` and `close` time strings (e.g. `{ open: '09:00', close: '18:00' }`)
   * or `null` when the salon is closed on that day.
   * The entire field is `null` when working hours have not been configured.
   */
  @ApiPropertyOptional() workingHours: Record<string, { open: string; close: string } | null> | null;

  /** IANA timezone identifier used to interpret `workingHours` (e.g. `'America/New_York'`). */
  @ApiProperty() timezone: string;

  // Audit

  /** Timestamp when the salon record was created. */
  @ApiProperty() createdAt: Date;

  /** Timestamp when the salon record was last updated. */
  @ApiProperty() updatedAt: Date;

  /**
   * Factory method that maps a {@link Salon} entity to a {@link SalonResponseDto}.
   *
   * Performs a direct field-by-field copy; no value transformations are applied.
   *
   * @param salon - The salon entity retrieved from the database.
   * @returns A fully populated {@link SalonResponseDto} instance.
   */
  static from(salon: Salon): SalonResponseDto {
    const dto = new SalonResponseDto();
    dto.id                        = salon.id;
    dto.addedById                 = salon.addedById;
    dto.addedBy                   = salon.addedBy
      ? { id: salon.addedBy.id, name: salon.addedBy.name, email: salon.addedBy.email, phone: salon.addedBy.phone, avatarUrl: salon.addedBy.avatarUrl, role: salon.addedBy.role }
      : null;
    dto.verifiedBy                = salon.verifiedBy;
    dto.name                      = salon.name;
    dto.slug                      = salon.slug;
    dto.description               = salon.description;
    dto.address                   = salon.address;
    dto.city                      = salon.city;
    dto.state                     = salon.state;
    dto.country                   = salon.country;
    dto.postalCode                = salon.postalCode;
    dto.latitude                  = salon.latitude;
    dto.longitude                 = salon.longitude;
    dto.phone                     = salon.phone;
    dto.email                     = salon.email;
    dto.logoUrl                   = salon.logoUrl;
    dto.coverImageUrl             = salon.coverImageUrl;
    dto.status                    = salon.status;
    dto.isVerified                = salon.isVerified;
    dto.verifiedAt                = salon.verifiedAt;
    dto.rejectionReason           = salon.rejectionReason;
    dto.avgServiceDurationMinutes = salon.avgServiceDurationMinutes;
    dto.maxQueueSize              = salon.maxQueueSize;
    dto.workingHours              = salon.workingHours;
    dto.timezone                  = salon.timezone;
    dto.createdAt                 = salon.createdAt;
    dto.updatedAt                 = salon.updatedAt;
    return dto;
  }
}
