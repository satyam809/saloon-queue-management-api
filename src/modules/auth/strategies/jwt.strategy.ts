import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { UserStatus } from '@common/enums/status.enum';
import { RedisService } from '@shared/services/redis.service';
import { UserService } from '@modules/user/user.service';
import { USER_CACHE_KEY, CACHE_TTL } from '@shared/constants/app.constants';

/**
 * Validates the Bearer token on every authenticated request.
 *
 * Status check strategy:
 *   1. Look up user status from Redis (TTL: 60 s).
 *   2. On cache miss, hit the DB once and populate the cache.
 *   3. If status is not ACTIVE, reject the request immediately.
 *
 * This means a suspended account is blocked within 60 s of suspension
 * without a DB query on every request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const cacheKey = USER_CACHE_KEY.STATUS(payload.sub);

    let status = await this.redisService.get(cacheKey);

    if (!status) {
      // Cache miss — fetch from DB and populate
      const user = await this.userService.findOne(payload.sub).catch(() => null);
      if (!user) throw new UnauthorizedException('Account not found');

      status = user.status;
      await this.redisService.set(cacheKey, status, CACHE_TTL.SHORT);
    }

    if (status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        status === UserStatus.SUSPENDED
          ? 'Account has been suspended'
          : 'Account is inactive',
      );
    }

    // Return the full payload so CurrentUser() decorator works
    return payload;
  }
}
