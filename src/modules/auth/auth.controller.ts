import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { User } from '../../entities/user.entity.js';
import { AllowUnverifiedEmail } from './allow-unverified-email.decorator.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { EmailVerificationService } from './email-verification.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto.js';
import { Public } from './public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @AllowUnverifiedEmail()
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: User) {
    return this.authService.logout(user);
  }

  @AllowUnverifiedEmail()
  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  @AllowUnverifiedEmail()
  @Post('email-otp/send')
  @HttpCode(202)
  async sendEmailOtp(@CurrentUser() user: User) {
    await this.emailVerification.sendOtp(user);
    return { message: 'Verification code queued for delivery' };
  }

  @AllowUnverifiedEmail()
  @Post('email-otp/verify')
  @HttpCode(200)
  async verifyEmailOtp(
    @CurrentUser() user: User,
    @Body() dto: VerifyEmailOtpDto,
  ) {
    await this.emailVerification.verifyOtp(user, dto.otp);
    return { message: 'Email verified' };
  }
}
