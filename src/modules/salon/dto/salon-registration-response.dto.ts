import { ApiProperty } from '@nestjs/swagger';
import { TokensDto, AuthUserDto } from '@modules/auth/dto/auth-response.dto';
import { SalonResponseDto } from './salon-response.dto';

/**
 * Response returned by POST /salons when the request includes owner registration data.
 * Combines the JWT token pair, the new owner's profile, and the created salon record
 * so the client is immediately authenticated after registering.
 */
export class SalonRegistrationResponseDto {
  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: SalonResponseDto })
  salon: SalonResponseDto;
}
