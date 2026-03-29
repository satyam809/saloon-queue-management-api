import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectSalonDto {
  @ApiProperty({
    example: 'Business licence document is missing or invalid.',
    description: 'Reason for rejection — stored on the salon record and sent to the owner.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason: string;
}
