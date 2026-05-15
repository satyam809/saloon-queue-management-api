import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSalonDto } from './create-salon.dto';
import { UpdateSalonOwnerDto } from './update-salon-owner.dto';
import { SalonStatus } from '@common/enums/status.enum';

export class UpdateSalonDto extends PartialType(CreateSalonDto) {
  @ApiPropertyOptional({
    enum: [SalonStatus.ACTIVE, SalonStatus.REJECTED, SalonStatus.ARCHIVED],
    description: 'ACTIVE → approve (staff/admin only), REJECTED → reject (staff/admin only), ARCHIVED → archive (owner/admin)',
  })
  @IsOptional()
  @IsEnum(SalonStatus)
  status?: SalonStatus;

  @ApiPropertyOptional({ description: 'Required when status is REJECTED.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @ApiPropertyOptional({
    type: UpdateSalonOwnerDto,
    description: 'Update the salon owner\'s profile details. SALON_OWNER must supply currentPassword when changing password. SUPER_ADMIN can omit it.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSalonOwnerDto)
  owner?: UpdateSalonOwnerDto;
}
