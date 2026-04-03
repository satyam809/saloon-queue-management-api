import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBarberDto } from './create-barber.dto';

/**
 * Omit salonId — barbers cannot be transferred between salons after creation.
 * All remaining fields are optional.
 */
export class UpdateBarberDto extends PartialType(
  OmitType(CreateBarberDto, ['salonId'] as const),
) {}
