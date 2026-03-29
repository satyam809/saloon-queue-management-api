import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Secret@123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)  // bcrypt silently truncates beyond 72 bytes
  password: string;
}
