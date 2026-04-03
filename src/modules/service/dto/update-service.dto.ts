import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

/**
 * Omit salonId — services cannot be transferred between salons after creation.
 */
export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['salonId'] as const),
) {}
