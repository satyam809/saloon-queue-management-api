import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BarberStatus } from '@common/enums/status.enum';
import { Barber } from '../entities/barber.entity';

export class BarberResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() salonId: string;
  @ApiPropertyOptional() userId: string | null;
  @ApiProperty() name: string;
  @ApiPropertyOptional() bio: string | null;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiPropertyOptional() email: string | null;
  @ApiPropertyOptional() phone: string | null;
  @ApiPropertyOptional({ type: [String] }) specializations: string[] | null;
  @ApiProperty() rating: number;
  @ApiProperty() totalReviews: number;
  @ApiProperty() isAvailable: boolean;
  @ApiProperty({ enum: BarberStatus }) status: BarberStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

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
