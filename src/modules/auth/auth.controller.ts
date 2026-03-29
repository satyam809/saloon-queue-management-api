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
  ApiOperation,
  ApiResponse,
  ApiTags,
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new customer account',
    description: 'Creates a new account with the CUSTOMER role and returns auth tokens.',
  })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Validates credentials via LocalStrategy. Returns an access token (short-lived) and a refresh token (long-lived).',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Request() req: any): Promise<AuthResponseDto> {
    // req.user is set by LocalStrategy after successful credential validation
    return this.authService.login(req.user);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

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
  @ApiResponse({ status: 200, type: TokensDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or already-used refresh token' })
  refresh(@Request() req: any): Promise<TokensDto> {
    // req.user is set by JwtRefreshStrategy and contains the JWT payload
    return this.authService.refresh(req.user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke refresh token and end session',
    description:
      'Deletes the stored refresh token from Redis. The access token remains valid ' +
      'until its natural expiry — clients must discard it locally.',
  })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  logout(@CurrentUser('sub') userId: string): Promise<void> {
    return this.authService.logout(userId);
  }

  // ─── Change password ──────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change password for the authenticated user',
    description:
      'Validates the current password, updates the hash, and revokes all active ' +
      'sessions — user must log in again with the new password.',
  })
  @ApiResponse({ status: 204, description: 'Password changed — all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Passwords do not match or same as current' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(userId, dto);
  }

  // ─── Forgot password ──────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Generates a one-time reset token (10-min TTL) and dispatches a reset email. ' +
      'Always returns 200 regardless of whether the email exists to prevent user enumeration.',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  // ─── Reset password ───────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset password using the emailed token',
    description:
      'Validates the one-time reset token (stored in Redis), updates the password hash, ' +
      'consumes the token, and revokes all active sessions.',
  })
  @ApiResponse({ status: 204, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Token invalid/expired or passwords do not match' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }
}
