import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({
    example: 'Repeated policy violations',
    description: 'Reason for suspension — stored in the activity log',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
