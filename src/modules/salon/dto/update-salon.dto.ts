import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateSalonDto } from './create-salon.dto';
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
}
