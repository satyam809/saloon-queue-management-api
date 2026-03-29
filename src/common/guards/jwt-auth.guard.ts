import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * Global JWT guard — applied to every route via APP_GUARD in CommonModule.
 *
 * Routes decorated with @Public() skip JWT verification entirely.
 * All other routes require a valid Bearer token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Provide specific messages for common JWT error cases
      const message: string =
        info?.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : info?.name === 'JsonWebTokenError'
            ? 'Access token is invalid'
            : info?.message ?? 'Authentication required';

      throw err ?? new UnauthorizedException(message);
    }
    return user;
  }
}
