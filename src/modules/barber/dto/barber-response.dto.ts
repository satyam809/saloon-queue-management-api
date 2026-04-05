import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BarberStatus } from '@common/enums/status.enum';
import { Barber } from '../entities/barber.entity';

/**
 * Outbound DTO representing a barber resource in API responses.
 *
 * Used by all barber endpoints (e.g. `GET /barbers`, `GET /barbers/:id`,
 * `POST /barbers`) to serialize {@link Barber} entities into a stable,
 * Swagger-documented shape. Numeric fields that are stored as `DECIMAL`
 * in the database (e.g. `rating`) are coerced to JavaScript `number` via
 * `Number()` in the {@link from} factory method.
 */
export class BarberResponseDto {
  /** Unique identifier (UUID) of the barber record. */
  @ApiProperty() id: string;

  /** UUID of the salon this barber belongs to. */
  @ApiProperty() salonId: string;

  /** UUID of the linked user account, or `null` for barbers without an account. */
  @ApiPropertyOptional() userId: string | null;

  /** Display name of the barber. */
  @ApiProperty() name: string;

  /** Optional biography or professional description. */
  @ApiPropertyOptional() bio: string | null;

  /** URL of the barber's profile avatar image, or `null` if not set. */
  @ApiPropertyOptional() avatarUrl: string | null;

  /** Contact email address for the barber, or `null` if not provided. */
  @ApiPropertyOptional() email: string | null;

  /** Contact phone number for the barber, or `null` if not provided. */
  @ApiPropertyOptional() phone: string | null;

  /** Free-form skill tags (e.g. `['fades', 'beard trim']`), or `null` if none set. */
  @ApiPropertyOptional({ type: [String] }) specializations: string[] | null;

  /** Average customer rating (0–5), derived from submitted reviews. */
  @ApiProperty() rating: number;

  /** Total number of reviews submitted for this barber. */
  @ApiProperty() totalReviews: number;

  /** Whether the barber is currently accepting new customers. */
  @ApiProperty() isAvailable: boolean;

  /** Current operational status of the barber (e.g. `ACTIVE`, `INACTIVE`). */
  @ApiProperty({ enum: BarberStatus }) status: BarberStatus;

  /** Timestamp when the barber record was created. */
  @ApiProperty() createdAt: Date;

  /** Timestamp when the barber record was last updated. */
  @ApiProperty() updatedAt: Date;

  /**
   * Factory method that maps a {@link Barber} entity to a {@link BarberResponseDto}.
   *
   * Decimal columns stored as strings by the MySQL driver (e.g. `rating`) are
   * explicitly cast to `number` via `Number()`.
   *
   * @param barber - The barber entity retrieved from the database.
   * @returns A fully populated {@link BarberResponseDto} instance.
   */
  static from(barber: Barber): BarberResponseDto {
    const dto        = new BarberResponseDto();
    dto.id           = barber.id;
    dto.salonId      = barber.salonId;
    dto.userId       = barber.userId;
    dto.name         = barber.name;
    dto.bio          = barber.bio;
    dto.avatarUrl    = barber.avatarUrl;
    dto.email        = barber.email;
    dto.phone        = barber.phone;
    dto.specializations = barber.specializations;
    dto.rating       = Number(barber.rating);
    dto.totalReviews = barber.totalReviews;
    dto.isAvailable  = barber.isAvailable;
    dto.status       = barber.status;
    dto.createdAt    = barber.createdAt;
    dto.updatedAt    = barber.updatedAt;
    return dto;
  }
}
