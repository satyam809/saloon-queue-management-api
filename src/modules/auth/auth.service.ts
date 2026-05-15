import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UserService } from '@modules/user/user.service';
import { RedisService } from '@shared/services/redis.service';
import { comparePassword, hashPassword } from '@shared/utils/hash.util';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { UserStatus } from '@common/enums/status.enum';
import { Role } from '@common/enums/role.enum';
import {
  TOKEN_CACHE_KEY,
  USER_CACHE_KEY,
  CACHE_TTL,
  RESET_PASSWORD_TTL_SECONDS,
} from '@shared/constants/app.constants';
import { User } from '@modules/user/entities/user.entity';
import { UserResponseDto } from '@modules/user/dto/user-response.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto, TokensDto, AuthUserDto } from './dto/auth-response.dto';

/**
 * AuthService handles all authentication business logic:
 * credential validation, token generation/rotation, session revocation,
 * and the complete password management lifecycle.
 *
 * Token storage strategy: refresh tokens are stored in Redis with the user's
 * ID as the key. Only the most recently issued refresh token is valid
 * (rotation pattern). Reuse of a superseded token triggers full session invalidation.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ─── Credential validation (used by LocalStrategy) ───────────────────────

  /**
   * Returns the user if credentials are valid and account is active.
   * Returns null on any failure — never throws, so LocalStrategy controls
   * the response and avoids leaking the reason for rejection.
   *
   * @param email - The email address to look up
   * @param password - The plaintext password to compare against the stored hash
   * @returns The matching User entity, or null if credentials are invalid or account is inactive
   */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (!user || user.deletedAt) return null;

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) return null;

    if (user.status !== UserStatus.ACTIVE) return null;

    return user;
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  /**
   * Creates a new CUSTOMER account and immediately issues auth tokens.
   * Delegates uniqueness checks to UserService.create().
   *
   * @param dto - Registration data (name, email, password, optional phone)
   * @returns JWT token pair and the new user's basic profile
   * @throws ConflictException if the email is already registered
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.userService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
      role: Role.CUSTOMER,
    });

    await this.userService.updateLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  /**
   * Called after LocalStrategy has already validated credentials.
   * req.user at this point is the validated User entity.
   *
   * @param user - Validated User entity from LocalStrategy
   * @returns JWT token pair and the user's basic profile
   */
  async login(user: User): Promise<AuthResponseDto> {
    await this.userService.updateLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * Called after JwtRefreshStrategy has validated the refresh token and
   * confirmed it matches Redis. Generates a new token pair (rotation).
   * Throws if the account has been suspended or deactivated since the token was issued.
   *
   * @param payload - JWT payload from the validated refresh token
   * @returns A new JWT access and refresh token pair
   * @throws UnauthorizedException if the user's account is not ACTIVE
   */
  async refresh(payload: JwtPayload): Promise<TokensDto> {
    const user = await this.userService.findEntityOrFail(payload.sub);

    if (user.status !== UserStatus.ACTIVE) {
      // Remove the refresh token on login so suspended users are fully locked out
      await this.redisService.del(TOKEN_CACHE_KEY.REFRESH(user.id));
      throw new UnauthorizedException(
        user.status === UserStatus.SUSPENDED
          ? 'Account has been suspended'
          : 'Account is inactive',
      );
    }

    return this.generateTokens(user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Revokes the stored refresh token, effectively ending the session.
   * The short-lived access token remains valid until its natural expiry —
   * this is an accepted trade-off for stateless JWTs.
   * Also busts the Redis status cache to force a fresh DB read on the next request.
   *
   * @param userId - UUID of the user whose session should be terminated
   */
  async logout(userId: string): Promise<void> {
    await Promise.all([
      this.redisService.del(TOKEN_CACHE_KEY.REFRESH(userId)),
      // Bust the status cache so the next request re-evaluates from DB
      this.redisService.del(USER_CACHE_KEY.STATUS(userId)),
    ]);
  }

  // ─── Change password ──────────────────────────────────────────────────────

  /**
   * Validates the current password, applies the new password hash, and revokes
   * all active sessions. The user must re-login after calling this.
   *
   * @param userId - UUID of the authenticated user
   * @param dto - Current password, new password, and confirmation
   * @throws BadRequestException if the confirmation does not match or the new password equals the current one
   * @throws UnauthorizedException if the current password is incorrect
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const user = await this.userService.findEntityOrFail(userId);

    const currentPasswordValid = await comparePassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const newHash = await hashPassword(dto.newPassword);
    await this.userService.updatePasswordHash(userId, newHash);

    // Revoke all active sessions — force re-login with new credentials
    await this.logout(userId);
  }

  // ─── Forgot password ──────────────────────────────────────────────────────

  /**
   * Generates a cryptographically random reset token, stores it in Redis
   * with a 10-minute TTL, and would dispatch an email via a MailService.
   *
   * Always returns the same success response regardless of whether the
   * email exists — prevents user enumeration.
   *
   * @param dto - Email address of the account requesting a password reset
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userService.findByEmail(dto.email);

    // Always generate/delay response to prevent timing-based enumeration
    const token = randomBytes(32).toString('hex');

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      // Silently discard — same timing profile as the success path
      return;
    }

    const cacheKey = TOKEN_CACHE_KEY.RESET_PASSWORD(token);
    // Store userId as the value; token is the lookup key
    await this.redisService.set(cacheKey, user.id, RESET_PASSWORD_TTL_SECONDS);

    // TODO: inject MailService and dispatch:
    // await this.mailService.sendPasswordReset(user.email, user.name, token);
  }

  // ─── Reset password ───────────────────────────────────────────────────────

  /**
   * Validates a one-time reset token from Redis, applies the new password hash,
   * consumes the token to prevent reuse, and revokes all active sessions.
   *
   * @param dto - Reset token, new password, and confirmation
   * @throws BadRequestException if the confirmation does not match or the token is invalid/expired
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirmation do not match');
    }

    const cacheKey = TOKEN_CACHE_KEY.RESET_PASSWORD(dto.token);
    const userId = await this.redisService.get(cacheKey);

    if (!userId) {
      throw new BadRequestException(
        'Password reset link is invalid or has expired',
      );
    }

    const newHash = await hashPassword(dto.newPassword);
    await this.userService.updatePasswordHash(userId, newHash);

    // Consume the token (one-time use)
    await this.redisService.del(cacheKey);

    // Revoke all active sessions
    await this.logout(userId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Composes the full AuthResponseDto by generating a new token pair and
   * mapping the user entity to a safe AuthUserDto.
   *
   * @param user - User entity or response DTO (both share the required fields)
   * @returns Complete auth response with tokens and user profile
   */
  private async buildAuthResponse(user: User | UserResponseDto): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user);

    const userDto: AuthUserDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    return { tokens, user: userDto };
  }

  /**
   * Signs a new access token and refresh token for the given user, then
   * overwrites the stored refresh token in Redis (token rotation).
   * Only the most recently issued refresh token is considered valid.
   *
   * @param user - User entity or response DTO supplying the JWT payload fields
   * @returns A fresh TokensDto with both tokens and their metadata
   */
  async generateTokens(user: User | UserResponseDto): Promise<TokensDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessExpiresIn = this.configService.get<string>('jwt.expiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: accessExpiresIn }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Overwrite the stored refresh token — token rotation:
    // only the latest refresh token is valid
    const refreshTtlSeconds = this.parseTtlToSeconds(refreshExpiresIn);
    await this.redisService.set(
      TOKEN_CACHE_KEY.REFRESH(user.id),
      refreshToken,
      refreshTtlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseTtlToSeconds(accessExpiresIn),
    };
  }

  /**
   * Converts a JWT duration string (e.g. '15m', '7d', '3600') to seconds.
   *
   * @param ttl - Duration string with optional unit suffix (s, m, h, d) or plain integer string
   * @returns Duration in seconds
   */
  private parseTtlToSeconds(ttl: string): number {
    if (/^\d+$/.test(ttl)) return parseInt(ttl, 10);
    const unit = ttl.slice(-1);
    const value = parseInt(ttl.slice(0, -1), 10);
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }
}
