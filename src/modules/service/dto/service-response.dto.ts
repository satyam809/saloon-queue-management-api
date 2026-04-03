import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Service } from '../entities/service.entity';

export class ServiceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() salonId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() category: string | null;
  @ApiProperty() price: number;
  @ApiPropertyOptional() discountPrice: number | null;
  @ApiProperty() durationMinutes: number;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

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
