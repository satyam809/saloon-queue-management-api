import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Triggers the JwtRefreshStrategy.
 * Used exclusively on POST /auth/refresh.
 *
 * Provides a clear error message when the refresh token is missing
 * or malformed before the strategy even runs.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        info?.message === 'No auth token'
          ? 'refreshToken is required in the request body'
          : (info?.message ?? 'Invalid or expired refresh token');

      throw err ?? new UnauthorizedException(message);
    }
    return user;
  }
}
