import { IsJWT, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /auth/refresh.
 * The refresh token must be sent in the request body (not in the Authorization
 * header) to avoid accidental exposure in server access logs.
 */
export class RefreshTokenDto {
  /**
   * A valid, unexpired refresh token previously issued by the server.
   * Each refresh token is single-use — upon successful rotation it is replaced
   * by a new token and the old one is immediately invalidated.
   */
  @ApiProperty({ description: 'The refresh token issued during login or previous refresh' })
  @IsNotEmpty()
  @IsJWT({ message: 'refreshToken must be a valid JWT' })
  refreshToken: string;
}
