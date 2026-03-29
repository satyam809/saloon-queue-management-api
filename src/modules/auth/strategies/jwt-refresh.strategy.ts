import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { RedisService } from '@shared/services/redis.service';
import { TOKEN_CACHE_KEY } from '@shared/constants/app.constants';

/**
 * Validates the refresh token on the /auth/refresh endpoint.
 *
 * Token is extracted from req.body.refreshToken so the client
 * sends it in the request body — not in the Authorization header —
 * which prevents accidental exposure in server logs.
 *
 * Validation steps:
 *   1. Verify JWT signature using the refresh secret.
 *   2. Check the token exactly matches what is stored in Redis.
 *      This implements token rotation: each refresh invalidates
 *      the previous refresh token (only the latest is valid).
 *
 * The raw token is attached to the payload so AuthService can
 * perform the Redis comparison without re-extracting it.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<JwtPayload & { refreshToken: string }> {
    const refreshToken = req.body?.refreshToken as string;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const storedToken = await this.redisService.get(
      TOKEN_CACHE_KEY.REFRESH(payload.sub),
    );

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token has expired or was already used — please log in again',
      );
    }

    if (storedToken !== refreshToken) {
      // Token mismatch — possible token theft (reuse of a rotated token).
      // Invalidate all sessions for this user.
      await this.redisService.del(TOKEN_CACHE_KEY.REFRESH(payload.sub));
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions have been invalidated',
      );
    }

    return { ...payload, refreshToken };
  }
}
