import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 *
 * When called without an argument it returns the full `JwtPayload` object
 * that was attached to `req.user` by `JwtAuthGuard`. When called with a
 * specific key it returns only that field, enabling concise controller params.
 *
 * @param data - Optional key of `JwtPayload` to pluck (e.g. `'sub'`, `'role'`).
 *               If omitted, the entire payload object is returned.
 *
 * @example
 * // Full payload
 * async getProfile(@CurrentUser() user: JwtPayload) {}
 *
 * // Single field
 * async getProfile(@CurrentUser('sub') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
