import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto, MessageResponseDto, TokensDto } from './dto/auth-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { ErrorResponseDto } from '@common/dto/error-response.dto';
import {
  ApiCommonErrors,
  ApiConflictErrors,
  ApiCreatedWrapped,
  ApiOkWrapped,
} from '@common/swagger/decorators';

/**
 * AuthController handles all authentication lifecycle endpoints:
 * registration, login, token refresh, logout, password changes,
 * and the forgot/reset password flow.
 *
 * Public endpoints are decorated with @Public() to bypass the global JWT guard.
 * Authenticated endpoints require a valid Bearer token in the Authorization header.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  /**
   * POST /auth/register
   * Creates a new CUSTOMER account and immediately returns an auth token pair.
   * The email must not already be registered on an active account.
   *
   * @param dto - Registration data (name, email, password, optional phone)
   * @returns JWT tokens and basic user profile
   */
  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new customer account',
    description: 'Creates a new account with the CUSTOMER role and returns auth tokens.',
  })
  @ApiCreatedWrapped(AuthResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  /**
   * POST /auth/login
   * Authenticates the user via email/password using LocalStrategy.
   * On success, returns a short-lived access token and a long-lived refresh token.
   * req.user is populated by LocalStrategy before this handler runs.
   *
   * @param req - Express request object with user entity attached by LocalStrategy
   * @returns JWT token pair and basic user profile
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Validates credentials via LocalStrategy. Returns an access token (short-lived) ' +
      'and a refresh token (long-lived, single-use with rotation).',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkWrapped(AuthResponseDto)
  @ApiUnauthorizedResponse({ description: 'Invalid email or password', type: ErrorResponseDto })
  login(@Request() req: any): Promise<AuthResponseDto> {
    // req.user is set by LocalStrategy after successful credential validation
    return this.authService.login(req.user);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * POST /auth/refresh
   * Rotates the token pair using a valid refresh token sent in the request body.
   * JwtRefreshStrategy validates the token signature and checks it against Redis.
   * Reusing an already-rotated token is treated as a theft signal and invalidates
   * all sessions for the user.
   *
   * @param req - Express request object with JWT payload attached by JwtRefreshStrategy
   * @returns New JWT access and refresh tokens
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({
    summary: 'Rotate tokens using a refresh token',
    description:
      'Validates the refresh token via JwtRefreshStrategy (signature + Redis match). ' +
      'Returns a new token pair. Each refresh token can only be used once (rotation). ' +
      'Reusing an already-rotated token is treated as a theft signal and invalidates all sessions.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkWrapped(TokensDto)
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or already-used refresh token',
    type: ErrorResponseDto,
  })
  refresh(@Request() req: any): Promise<TokensDto> {
    // req.user is set by JwtRefreshStrategy and contains the JWT payload
    return this.authService.refresh(req.user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * POST /auth/logout
   * Revokes the user's refresh token in Redis, ending the current session.
   * The access token stays valid until its natural expiry; clients must discard it locally.
   * Requires a valid Bearer token in the Authorization header.
   *
   * @param userId - UUID of the authenticated user, extracted from the JWT sub claim
   * @returns void — responds with 204 No Content
   */
  @ApiBearerAuth('bearer')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke refresh token and end session',
    description:
      'Deletes the stored refresh token from Redis. The access token remains valid ' +
      'until its natural expiry — clients must discard it locally.',
  })
  @ApiNoContentResponse({ description: 'Logged out successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token', type: ErrorResponseDto })
  logout(@CurrentUser('sub') userId: string): Promise<void> {
    return this.authService.logout(userId);
  }

  // ─── Change password ──────────────────────────────────────────────────────

  /**
   * POST /auth/change-password
   * Validates the current password, sets the new one, and revokes all active sessions.
   * The user must re-authenticate with the new password after this call.
   * Requires a valid Bearer token in the Authorization header.
   *
   * @param userId - UUID of the authenticated user, extracted from the JWT sub claim
   * @param dto - Current password, new password, and confirmation
   * @returns void — responds with 204 No Content
   */
  @ApiBearerAuth('bearer')
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change password for the authenticated user',
    description:
      'Validates the current password, updates the hash, and revokes all active ' +
      'sessions — the user must log in again with the new password.',
  })
  @ApiNoContentResponse({ description: 'Password changed — all sessions revoked.' })
  @ApiCommonErrors()
  changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(userId, dto);
  }

  // ─── Forgot password ──────────────────────────────────────────────────────

  /**
   * POST /auth/forgot-password
   * Generates a one-time password reset token (10-minute TTL) and dispatches a
   * reset email to the address provided. Always returns the same 200 response
   * regardless of whether the email is registered, preventing user enumeration.
   *
   * @param dto - Email address to send the reset link to
   * @returns A generic success message
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Generates a one-time reset token (10-min TTL) and dispatches a reset email. ' +
      'Always returns 200 regardless of whether the email exists to prevent user enumeration.',
  })
  @ApiOkWrapped(MessageResponseDto)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  // ─── Reset password ───────────────────────────────────────────────────────

  /**
   * POST /auth/reset-password
   * Consumes a one-time reset token from Redis, sets the new password hash,
   * and revokes all active sessions. The token is invalidated after first use.
   *
   * @param dto - One-time reset token, new password, and confirmation
   * @returns void — responds with 204 No Content
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset password using the emailed token',
    description:
      'Validates the one-time reset token (stored in Redis), updates the password hash, ' +
      'consumes the token, and revokes all active sessions.',
  })
  @ApiNoContentResponse({ description: 'Password reset successfully.' })
  @ApiCommonErrors()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }
}
