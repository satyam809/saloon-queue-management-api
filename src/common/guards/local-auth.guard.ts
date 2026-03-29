import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Triggers the LocalStrategy (email + password validation).
 * Used exclusively on POST /auth/login.
 *
 * Named export instead of inline `AuthGuard('local')` so it can be
 * mocked in tests and referenced explicitly without magic strings.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
