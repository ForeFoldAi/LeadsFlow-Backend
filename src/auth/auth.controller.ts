import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Send2faOtpDto } from './dto/send-2fa-otp.dto';
import { Verify2faOtpDto } from './dto/verify-2fa-otp.dto';
import { TwoFactorStatusResponseDto } from './dto/2fa-status-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TokenAuthGuard } from './guards/token-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body(ValidationPipe) signupDto: SignupDto,
  ): Promise<AuthResponseDto> {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
  ): Promise<AuthResponseDto> {
    console.log(`🔐 Login attempt for: ${loginDto.email}`);
    const result = await this.authService.login(loginDto);
    console.log(`✅ Login completed for: ${loginDto.email}`);
    return result;
  }

  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  async loginWith2fa(
    @Body(ValidationPipe) verify2faOtpDto: Verify2faOtpDto,
  ): Promise<AuthResponseDto> {
    console.log(`🔐 2FA Login verification for: ${verify2faOtpDto.email}`);
    const result = await this.authService.loginWith2fa(verify2faOtpDto);
    console.log(`✅ 2FA Login response:`, {
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
      hasUser: !!result.user,
    });
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body(ValidationPipe) refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req): Promise<{ message: string }> {
    await this.authService.logout(req.user.sub);
    return { message: 'Logged out successfully' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(ValidationPipe) verifyOtpDto: VerifyOtpDto,
  ): Promise<{ valid: boolean; message: string }> {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // Two-Factor Authentication Endpoints
  @Post('2fa/send-otp')
  @HttpCode(HttpStatus.OK)
  async send2faOtp(
    @Body(ValidationPipe) send2faOtpDto: Send2faOtpDto,
  ): Promise<{ message: string }> {
    return this.authService.send2faOtp(send2faOtpDto);
  }

  @Post('2fa/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verify2faOtp(
    @Body(ValidationPipe) verify2faOtpDto: Verify2faOtpDto,
  ): Promise<{
    valid: boolean;
    message: string;
    user?: {
      id: number;
      email: string;
      fullName: string;
      role: string;
      companyName?: string;
    };
  }> {
    return this.authService.verify2faOtp(verify2faOtpDto);
  }

  @Post('2fa/enable')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2fa(@Request() req): Promise<{ message: string }> {
    console.log(`🔐 Enable 2FA request for user ID: ${req.user.sub}`);
    const result = await this.authService.enable2fa(req.user.sub);
    console.log(`✅ 2FA enabled for user ID: ${req.user.sub}`);
    return result;
  }

  @Post('2fa/disable')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2fa(@Request() req): Promise<{ message: string }> {
    return this.authService.disable2fa(req.user.sub);
  }

  @Get('2fa/status')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async get2faStatus(@Request() req): Promise<TwoFactorStatusResponseDto> {
    return this.authService.get2faStatus(req.user.sub);
  }

  @Get('test-email')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async testEmail(@Request() req): Promise<{ success: boolean; message: string; error?: string }> {
    return this.authService.testEmail(req.user.sub);
  }

  @Get('test-auth')
  @UseGuards(TokenAuthGuard)
  @HttpCode(HttpStatus.OK)
  async testAuth(@Request() req): Promise<{ success: boolean; userId: number; message: string }> {
    return {
      success: true,
      userId: req.user.sub,
      message: 'Authentication successful! Your token is working correctly.',
    };
  }
}

