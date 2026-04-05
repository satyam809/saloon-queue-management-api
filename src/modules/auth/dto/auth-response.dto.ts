import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

/**
 * Represents the JWT token pair returned after a successful login or refresh.
 */
export class TokensDto {
  /** Signed JWT access token. Short-lived (see jwt.expiresIn config). */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  /** Signed JWT refresh token. Long-lived, single-use with rotation. */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  /** Token type, always "Bearer". */
  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  /** Access token time-to-live in seconds. */
  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}

/**
 * Minimal user fields embedded in the authentication response.
 * Contains only non-sensitive identity data needed by the client immediately after auth.
 */
export class AuthUserDto {
  /** Unique user identifier (UUID v4). */
  @ApiProperty()
  id: string;

  /** User's display name. */
  @ApiProperty()
  name: string;

  /** User's email address. */
  @ApiProperty()
  email: string;

  /** User's assigned role, determines access permissions. */
  @ApiProperty({ enum: Role })
  role: Role;

  /** URL of the user's avatar image, or null if not set. */
  @ApiProperty({ nullable: true })
  avatarUrl: string | null;
}

/**
 * Full authentication response returned by POST /auth/register and POST /auth/login.
 * Combines the token pair with the authenticated user's basic profile.
 */
export class AuthResponseDto {
  /** JWT access and refresh tokens. */
  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  /** Basic profile of the authenticated user. */
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/**
 * Generic message-only response used for operations that have no data payload
 * (e.g., forgot-password confirmation).
 */
export class MessageResponseDto {
  /** Human-readable status message for the client. */
  @ApiProperty()
  message: string;
}
