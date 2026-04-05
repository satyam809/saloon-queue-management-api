import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for suspending a user account.
 *
 * Used by the `PATCH /users/:id/suspend` endpoint. The provided reason
 * is recorded in the activity log so that administrators have an audit
 * trail for every suspension action.
 */
export class SuspendUserDto {
  /**
   * Human-readable explanation for the suspension.
   *
   * This value is stored in the activity log entry that is created
   * alongside the status change. Maximum length is 500 characters.
   *
   * @example 'Repeated policy violations'
   */
  @ApiProperty({
    example: 'Repeated policy violations',
    description: 'Reason for suspension — stored in the activity log',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
