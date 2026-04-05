import { PartialType } from '@nestjs/swagger';
import { CreateSalonDto } from './create-salon.dto';

/**
 * Data Transfer Object for updating an existing salon.
 *
 * Used by the `PATCH /salons/:id` endpoint. All fields are optional —
 * only the properties included in the request body will be updated.
 * Validation rules are inherited from {@link CreateSalonDto} via
 * NestJS's `PartialType` helper, which marks every property optional
 * while preserving their original `class-validator` and Swagger metadata.
 */
export class UpdateSalonDto extends PartialType(CreateSalonDto) {}
