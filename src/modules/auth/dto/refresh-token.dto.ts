import { IsJWT, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued during login or previous refresh' })
  @IsNotEmpty()
  @IsJWT({ message: 'refreshToken must be a valid JWT' })
  refreshToken: string;
}
