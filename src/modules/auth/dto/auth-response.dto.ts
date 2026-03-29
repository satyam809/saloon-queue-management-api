import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@common/enums/role.enum';

export class TokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}
