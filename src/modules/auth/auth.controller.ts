import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { I18n, I18nContext } from 'nestjs-i18n';
import type { I18nTranslations } from '../../generated/i18n.generated.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AllowUnverifiedEmail } from './allow-unverified-email.decorator.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { EmailVerificationService } from './email-verification.service.js';
import { loginSchema, type LoginDto } from './dto/login.dto.js';
import {
  loginMfaSchema,
  setMfaSchema,
  type LoginMfaDto,
  type SetMfaDto,
} from './dto/mfa.dto.js';
import { MfaService } from './mfa.service.js';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordDto,
  type UpdateProfileDto,
} from './dto/profile.dto.js';
import {
  refreshTokenSchema,
  type RefreshTokenDto,
} from './dto/refresh-token.dto.js';
import {
  verifyEmailOtpSchema,
  type VerifyEmailOtpDto,
} from './dto/verify-email-otp.dto.js';
import { Public } from './public.decorator.js';

// Stricter than the global limit (ThrottlerModule in AppModule), per client IP,
// against password and OTP guessing.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly mfa: MfaService,
    private readonly users: UsersService,
  ) {}

  @ApiOperation({
    summary:
      'Log in. Returns tokens (Swagger authorizes itself with them), or { mfaRequired, challengeToken } when the user has MFA on',
  })
  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) dto: LoginDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    return 'mfaRequired' in result
      ? { ...result, message: i18n.t('messages.mfaCodeSent') }
      : result;
  }

  @ApiOperation({
    summary:
      'Second login step with MFA: the challenge token and the emailed code',
  })
  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('login/mfa')
  @HttpCode(200)
  loginWithMfa(@Body({ schema: loginMfaSchema }) dto: LoginMfaDto) {
    return this.authService.loginWithMfa(dto.challengeToken, dto.otp);
  }

  @ApiOperation({
    summary: 'Turn the emailed sign-in code on or off for yourself',
  })
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Put('me/mfa')
  @HttpCode(200)
  async setMfa(
    @CurrentUser() user: User,
    @Body({ schema: setMfaSchema }) dto: SetMfaDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    await this.mfa.setEnabled(user, dto.enabled, dto.password);
    return {
      message: i18n.t(
        dto.enabled ? 'messages.mfaEnabled' : 'messages.mfaDisabled',
      ),
    };
  }

  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Log out (revokes the refresh token)' })
  @ApiBearerAuth()
  @AllowUnverifiedEmail()
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: User) {
    return this.authService.logout(user);
  }

  @ApiOperation({ summary: 'The logged-in user' })
  @ApiBearerAuth()
  @AllowUnverifiedEmail()
  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  @ApiOperation({ summary: 'Change your own name' })
  @ApiBearerAuth()
  @Patch('me')
  updateMe(
    @CurrentUser() user: User,
    @Body({ schema: updateProfileSchema }) dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  @ApiOperation({
    summary:
      'Change your password. Returns a new token pair; your other sessions end',
  })
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Put('me/password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: User,
    @Body({ schema: changePasswordSchema }) dto: ChangePasswordDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const tokens = await this.authService.changePassword(
      user,
      dto.currentPassword,
      dto.password,
    );
    return { ...tokens, message: i18n.t('messages.passwordChanged') };
  }

  @ApiOperation({ summary: 'Email a verification code (see Mailpit in dev)' })
  @ApiBearerAuth()
  @AllowUnverifiedEmail()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('email-otp/send')
  @HttpCode(202)
  async sendEmailOtp(
    @CurrentUser() user: User,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    await this.emailVerification.sendOtp(user);
    return { message: i18n.t('messages.otpQueued') };
  }

  @ApiOperation({ summary: 'Verify the email with the emailed code' })
  @ApiBearerAuth()
  @AllowUnverifiedEmail()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('email-otp/verify')
  @HttpCode(200)
  async verifyEmailOtp(
    @CurrentUser() user: User,
    @Body({ schema: verifyEmailOtpSchema }) dto: VerifyEmailOtpDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    await this.emailVerification.verifyOtp(user, dto.otp);
    return { message: i18n.t('messages.emailVerified') };
  }
}
