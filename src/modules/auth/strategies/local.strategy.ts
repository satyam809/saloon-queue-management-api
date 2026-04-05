import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Validates email + password credentials on the login endpoint.
 * Uses the 'email' field as the username identifier (overrides Passport's default 'username').
 * The returned user object is attached to req.user by Passport and passed to the login handler.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  /**
   * Called by Passport with the extracted email and password fields.
   * Delegates to AuthService.validateCredentials() which handles hash comparison
   * and account status checks without leaking failure reasons.
   *
   * @param email - The email address extracted from the request body
   * @param password - The plaintext password extracted from the request body
   * @returns The validated User entity to be attached to req.user
   * @throws UnauthorizedException with a deliberately vague message if validation fails
   */
  async validate(email: string, password: string) {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      // Deliberately vague — don't reveal whether email or password was wrong
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }
}
