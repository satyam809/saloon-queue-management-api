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
   */
  async login(user: User): Promise<AuthResponseDto> {
    await this.userService.updateLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * Called after JwtRefreshStrategy has validated the refresh token and
   * confirmed it matches Redis. Generates a new token pair (rotation).
   *
   * @param payload - JWT payload from the validated refresh token
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
   */
  async logout(userId: string): Promise<void> {
    await Promise.all([
      this.redisService.del(TOKEN_CACHE_KEY.REFRESH(userId)),
      // Bust the status cache so the next request re-evaluates from DB
      this.redisService.del(USER_CACHE_KEY.STATUS(userId)),
    ]);
  }

  // ─── Change password ──────────────────────────────────────────────────────

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

  private async generateTokens(user: User | UserResponseDto): Promise<TokensDto> {
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
