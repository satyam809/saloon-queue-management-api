import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request body for the approve-salon endpoint.
 *
 * All fields are optional — the body may be omitted entirely if no
 * additional note is required.
 */
export class ApproveSalonDto {
  /**
   * Optional free-text note recorded alongside the approval decision.
   * Useful for internal audit trails or owner-facing welcome messages.
   */
  @ApiPropertyOptional({
    example: 'All documentation verified — welcome aboard!',
    description: 'Optional note recorded alongside the approval.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
