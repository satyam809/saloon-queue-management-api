import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalonStatus } from '@common/enums/status.enum';
import { Salon } from '../entities/salon.entity';

export class SalonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiPropertyOptional() verifiedBy: string | null;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() description: string | null;

  // Location
  @ApiPropertyOptional() address: string | null;
  @ApiPropertyOptional() city: string | null;
  @ApiPropertyOptional() state: string | null;
  @ApiProperty() country: string;
  @ApiPropertyOptional() postalCode: string | null;
  @ApiPropertyOptional() latitude: number | null;
  @ApiPropertyOptional() longitude: number | null;

  // Contact
  @ApiPropertyOptional() phone: string | null;
  @ApiPropertyOptional() email: string | null;

  // Media
  @ApiPropertyOptional() logoUrl: string | null;
  @ApiPropertyOptional() coverImageUrl: string | null;

  // Business config
  @ApiProperty({ enum: SalonStatus }) status: SalonStatus;
  @ApiProperty() isVerified: boolean;
  @ApiPropertyOptional() verifiedAt: Date | null;
  @ApiPropertyOptional() rejectionReason: string | null;
  @ApiProperty() avgServiceDurationMinutes: number;
  @ApiProperty() maxQueueSize: number;
  @ApiPropertyOptional() workingHours: Record<string, { open: string; close: string } | null> | null;
  @ApiProperty() timezone: string;

  // Audit
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(salon: Salon): SalonResponseDto {
    const dto = new SalonResponseDto();
    dto.id                        = salon.id;
    dto.ownerId                   = salon.ownerId;
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
