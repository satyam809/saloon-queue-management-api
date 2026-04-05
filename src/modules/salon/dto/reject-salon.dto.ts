import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for the reject-salon endpoint.
 *
 * The `reason` field is required and will be stored on the salon record
 * so the owner can understand why their registration was declined.
 */
export class RejectSalonDto {
  /**
   * Human-readable explanation of why the salon registration was rejected.
   * Stored on the salon entity and should be sent to the owner (max 1000 characters).
   */
  @ApiProperty({
    example: 'Business licence document is missing or invalid.',
    description: 'Reason for rejection — stored on the salon record and sent to the owner.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason: string;
}
