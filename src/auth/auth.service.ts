import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { PasswordReset } from '../entities/otp.entity';
import { TwoFactorOtp } from '../entities/two-factor-otp.entity';
import { SecuritySettings } from '../entities/security-settings.entity';
import { UserRole, Industry } from './enums/user.enums';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Send2faOtpDto } from './dto/send-2fa-otp.dto';
import { Verify2faOtpDto } from './dto/verify-2fa-otp.dto';
import { TwoFactorStatusResponseDto } from './dto/2fa-status-response.dto';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';

@Injectable()
export class AuthService {
  // Rate limiting: Track recent OTP sends to prevent duplicates
  private recentOtpSends = new Map<string, number>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(TwoFactorOtp)
    private twoFactorOtpRepository: Repository<TwoFactorOtp>,
    @InjectRepository(SecuritySettings)
    private securitySettingsRepository: Repository<SecuritySettings>,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) {}

  async signup(signupDto: SignupDto): Promise<AuthResponseDto> {
    // Validate password match
    if (signupDto.password !== signupDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    // Create user (ID will be auto-generated as integer)
    const userData: Partial<User> = {
      fullName: signupDto.fullName,
      email: signupDto.email,
      password: hashedPassword,
      role: signupDto.role,
      customRole: signupDto.role === UserRole.OTHER ? signupDto.customRole : undefined,
      companyName: signupDto.companyName,
      companySize: signupDto.companySize,
      industry: signupDto.industry,
      customIndustry:
        signupDto.industry === Industry.OTHER ? signupDto.customIndustry : undefined,
      website: signupDto.website || undefined,
      isActive: true,
      subscriptionStatus: 'trial',
      subscriptionPlan: 'basic',
    };

    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(savedUser.id);

    return {
      ...tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: savedUser.customRole || savedUser.role,
        companyName: savedUser.companyName || undefined,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if 2FA is enabled for this user
    const securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: user.id.toString() },
    });

    // If 2FA is enabled, require OTP verification instead of direct login
    if (securitySettings && securitySettings.twoFactorEnabled) {
      // Rate limiting: Check if OTP was recently sent to this user
      const rateLimitKey = `login:${user.email}`;
      const lastOtpTime = this.recentOtpSends.get(rateLimitKey);
      const now = Date.now();

      if (lastOtpTime && now - lastOtpTime < 5000) {
        const waitTime = Math.ceil((5000 - (now - lastOtpTime)) / 1000);
        console.log(`⚠️ Duplicate OTP request detected for ${user.email}, blocking...`);
        throw new BadRequestException(`OTP was already sent. Please wait ${waitTime} seconds before requesting again.`);
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Invalidate all previous 2FA OTPs for this user
      await this.twoFactorOtpRepository.update(
        { userId: user.id.toString(), used: false },
        { used: true },
      );

      // Save new OTP
      const otpRecord = this.twoFactorOtpRepository.create({
        userId: user.id.toString(),
        email: user.email.toLowerCase().trim(),
        otp,
        expiresAt,
        used: false,
      });
      await this.twoFactorOtpRepository.save(otpRecord);

      // Send OTP email
      try {
        console.log(`📧 Sending login 2FA OTP to ${user.email}`);
        await this.emailService.send2faOtp(user.email, otp);
        console.log(`✅ Login 2FA OTP sent successfully to ${user.email}`);

        // Record the time we sent this OTP for rate limiting
        this.recentOtpSends.set(rateLimitKey, Date.now());

        // Clean up old entries after 10 seconds
        setTimeout(() => this.recentOtpSends.delete(rateLimitKey), 10000);
      } catch (error) {
        console.error('❌ Failed to send 2FA OTP during login:', error);
        throw new BadRequestException('Failed to send OTP email. Please try again later.');
      }

      // Return response indicating 2FA is required (no tokens yet)
      return {
        requiresTwoFactor: true,
        message: 'Two-factor authentication required. Please check your email for OTP.',
        email: user.email,
      } as any; // We'll need to update the AuthResponseDto type
    }

    // For sub-users, verify parent user exists
    // Note: We don't check this during login, but during subsequent API calls

    // If 2FA is not enabled, generate tokens and complete login
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.customRole || user.role,
        companyName: user.companyName || undefined,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Validate refresh token
    const tokenRecord = await this.tokenService.validateToken(
      refreshToken,
      'refresh',
    );

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new access token
    const accessToken = await this.tokenService.createAccessToken(user.id);

    return { accessToken };
  }

  async logout(userId: number): Promise<void> {
    // Delete all tokens for the user
    await this.tokenService.deleteUserTokens(userId);
  }

  async validateAccessToken(accessToken: string): Promise<User | null> {
    const tokenRecord = await this.tokenService.validateToken(
      accessToken,
      'access',
    );

    if (!tokenRecord) {
      return null;
    }

    // Find user by ID from token
    const user = await this.userRepository.findOne({
      where: { id: tokenRecord.userId },
    });

    // If user not found, return null (will be handled as unauthorized)
    if (!user) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      return null;
    }

    return user;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    // Check if user exists in database
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      // Email does not exist in database - return error
      throw new NotFoundException('Email not found in our database');
    }

    // Verify email is valid and user is active
    if (!user.isActive) {
      throw new BadRequestException('Account is inactive. Please contact support.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate all previous OTPs for this user
    await this.passwordResetRepository.update(
      { userId: user.id.toString(), used: false },
      { used: true },
    );

    // Save new OTP
    const otpRecord = this.passwordResetRepository.create({
      userId: user.id.toString(), // Convert number to string
      email: forgotPasswordDto.email,
      otp,
      expiresAt,
      used: false,
    });
    await this.passwordResetRepository.save(otpRecord);

    // Send email with OTP only if user exists
    try {
      await this.emailService.sendPasswordResetOtp(forgotPasswordDto.email, otp);
      return { message: 'OTP has been sent to your email address' };
    } catch (error) {
      // If email fails, delete the OTP record and throw error
      await this.passwordResetRepository.delete({ id: otpRecord.id });
      console.error('Failed to send email:', error);
      throw new BadRequestException('Failed to send OTP email. Please try again later.');
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ valid: boolean; message: string }> {
    // Find user first
    const user = await this.userRepository.findOne({
      where: { email: verifyOtpDto.email },
    });

    if (!user) {
      return { valid: false, message: 'Invalid email' };
    }

    // Find valid OTP
    const otpRecord = await this.passwordResetRepository.findOne({
      where: {
        userId: user.id.toString(),
        email: verifyOtpDto.email,
        otp: verifyOtpDto.otp,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      return { valid: false, message: 'Invalid OTP' };
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      return { valid: false, message: 'OTP has expired' };
    }

    return { valid: true, message: 'OTP verified successfully' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // Validate passwords match
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Find user first
    const user = await this.userRepository.findOne({
      where: { email: resetPasswordDto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify OTP
    const otpRecord = await this.passwordResetRepository.findOne({
      where: {
        userId: user.id.toString(),
        email: resetPasswordDto.email,
        otp: resetPasswordDto.otp,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Mark OTP as used
    otpRecord.used = true;
    await this.passwordResetRepository.save(otpRecord);

    // Invalidate all tokens for this user
    await this.tokenService.deleteUserTokens(user.id);

    // Send success email (don't wait for it)
    this.emailService.sendPasswordResetSuccess(resetPasswordDto.email).catch((error) => {
      console.error('Failed to send success email:', error);
    });

    return { message: 'Password reset successfully' };
  }

  private async generateTokens(userId: number): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate tokens
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.createAccessToken(userId),
      this.tokenService.createRefreshToken(userId),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Cleanup expired OTPs (can be called periodically)
  async cleanupExpiredOtps(): Promise<void> {
    await this.passwordResetRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  // Two-Factor Authentication Methods
  async send2faOtp(send2faOtpDto: Send2faOtpDto): Promise<{ message: string }> {
    // Check if user exists
    const user = await this.userRepository.findOne({
      where: { email: send2faOtpDto.email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, an OTP has been sent' };
    }

    // Verify user is active
    if (!user.isActive) {
      throw new BadRequestException('Account is inactive. Please contact support.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate all previous 2FA OTPs for this user
    await this.twoFactorOtpRepository.update(
      { userId: user.id.toString(), used: false },
      { used: true },
    );

    // Save new OTP
    const otpRecord = this.twoFactorOtpRepository.create({
      userId: user.id.toString(),
      email: send2faOtpDto.email.toLowerCase().trim(),
      otp,
      expiresAt,
      used: false,
    });
    await this.twoFactorOtpRepository.save(otpRecord);

    // Send email with OTP
    try {
      console.log(`📧 Sending manual 2FA OTP to ${send2faOtpDto.email}`);
      await this.emailService.send2faOtp(send2faOtpDto.email, otp);
      console.log(`✅ Manual 2FA OTP sent successfully to ${send2faOtpDto.email}`);
      return { message: 'OTP has been sent to your email address' };
    } catch (error) {
      // If email fails, delete the OTP record and throw error
      await this.twoFactorOtpRepository.delete({ id: otpRecord.id });
      console.error('❌ Failed to send manual 2FA OTP:', error);
      throw new BadRequestException('Failed to send OTP email. Please try again later.');
    }
  }

  async verify2faOtp(verify2faOtpDto: Verify2faOtpDto): Promise<{
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
    // Find user first
    const user = await this.userRepository.findOne({
      where: { email: verify2faOtpDto.email },
    });

    if (!user) {
      return { valid: false, message: 'Invalid email' };
    }

    // Find valid OTP
    const otpRecord = await this.twoFactorOtpRepository.findOne({
      where: {
        userId: user.id.toString(),
        email: verify2faOtpDto.email,
        otp: verify2faOtpDto.otp,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      return { valid: false, message: 'Invalid OTP' };
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      return { valid: false, message: 'OTP has expired' };
    }

    // Mark OTP as used
    otpRecord.used = true;
    await this.twoFactorOtpRepository.save(otpRecord);

    return {
      valid: true,
      message: 'OTP verified successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.customRole || user.role,
        companyName: user.companyName || undefined,
      },
    };
  }

  async loginWith2fa(verify2faOtpDto: Verify2faOtpDto): Promise<AuthResponseDto> {
    console.log(`🔐 Login with 2FA attempt for: ${verify2faOtpDto.email}`);

    // Check if user exists
    const user = await this.userRepository.findOne({
      where: { email: verify2faOtpDto.email },
    });

    if (!user) {
      console.log(`❌ User not found: ${verify2faOtpDto.email}`);
      throw new UnauthorizedException('Invalid email or OTP');
    }

    console.log(`✅ User found: ${user.fullName} (ID: ${user.id})`);

    // Check if user is active
    if (!user.isActive) {
      console.log(`❌ User account is inactive: ${verify2faOtpDto.email}`);
      throw new UnauthorizedException('Account is inactive. Please contact support.');
    }

    // Find valid OTP
    console.log(`🔍 Searching for OTP with:`, {
      userId: user.id.toString(),
      email: verify2faOtpDto.email,
      otp: verify2faOtpDto.otp,
      used: false,
    });

    const otpRecord = await this.twoFactorOtpRepository.findOne({
      where: {
        userId: user.id.toString(),
        email: verify2faOtpDto.email,
        otp: verify2faOtpDto.otp,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      // Debug: Find any OTP records for this user
      const allUserOtps = await this.twoFactorOtpRepository.find({
        where: { userId: user.id.toString() },
        order: { createdAt: 'DESC' },
        take: 5,
      });

      console.log(`❌ Invalid OTP for ${verify2faOtpDto.email}`);
      console.log(`📋 Recent OTPs for user:`, allUserOtps.map(o => ({
        otp: o.otp,
        email: o.email,
        used: o.used,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
      })));
      console.log(`🔍 Looking for OTP: "${verify2faOtpDto.otp}" (length: ${verify2faOtpDto.otp?.length})`);

      throw new UnauthorizedException('Invalid or expired OTP');
    }

    console.log(`✅ Valid OTP found for ${verify2faOtpDto.email}`);

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      console.log(`❌ OTP expired for ${verify2faOtpDto.email}`);
      throw new UnauthorizedException('OTP has expired. Please request a new one.');
    }

    console.log(`✅ OTP is valid and not expired`);

    // Mark OTP as used
    otpRecord.used = true;
    await this.twoFactorOtpRepository.save(otpRecord);

    console.log(`✅ OTP marked as used`);

    // Generate tokens and complete login
    const tokens = await this.generateTokens(user.id);

    console.log(`✅ Tokens generated for user ${user.id}: accessToken=${tokens.accessToken.substring(0, 20)}...`);

    const response = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.customRole || user.role,
        companyName: user.companyName || undefined,
      },
    };

    console.log(`✅ Login with 2FA successful for ${user.email}`);
    console.log(`✅ Response structure:`, {
      hasAccessToken: !!response.accessToken,
      accessTokenLength: response.accessToken?.length,
      hasRefreshToken: !!response.refreshToken,
      refreshTokenLength: response.refreshToken?.length,
      hasUser: !!response.user,
      userId: response.user?.id,
    });

    return response;
  }

  async enable2fa(userId: number): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create security settings
    let securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: user.id.toString() },
    });

    if (!securitySettings) {
      securitySettings = this.securitySettingsRepository.create({
        userId: user.id.toString(),
        twoFactorEnabled: false,
        loginNotifications: true,
        sessionTimeout: '30',
        twoFactorMethod: 'email',
      });
    }

    if (securitySettings.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    securitySettings.twoFactorEnabled = true;
    securitySettings.lastTwoFactorSetup = new Date();
    await this.securitySettingsRepository.save(securitySettings);

    // Rate limiting: Check if OTP was recently sent
    const rateLimitKey = `enable2fa:${user.email}`;
    const lastOtpTime = this.recentOtpSends.get(rateLimitKey);
    const now = Date.now();

    if (lastOtpTime && now - lastOtpTime < 10000) {
      const waitTime = Math.ceil((10000 - (now - lastOtpTime)) / 1000);
      console.log(`⚠️ Duplicate 2FA enable request detected for ${user.email}, blocking...`);
      return { message: `Two-factor authentication was already enabled. Please wait ${waitTime} seconds.` };
    }

    // Generate and send a test OTP to confirm setup
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate all previous 2FA OTPs for this user
    await this.twoFactorOtpRepository.update(
      { userId: user.id.toString(), used: false },
      { used: true },
    );

    // Save new OTP
    const otpRecord = this.twoFactorOtpRepository.create({
      userId: user.id.toString(),
      email: user.email.toLowerCase().trim(),
      otp,
      expiresAt,
      used: false,
    });
    await this.twoFactorOtpRepository.save(otpRecord);

    // Send confirmation email with test OTP
    try {
      console.log(`📧 Sending 2FA setup confirmation to ${user.email}`);
      await this.emailService.send2faSetupConfirmation(user.email, otp);
      console.log(`✅ 2FA setup confirmation sent successfully to ${user.email}`);

      // Record the time we sent this OTP for rate limiting
      this.recentOtpSends.set(rateLimitKey, Date.now());

      // Clean up old entries after 15 seconds
      setTimeout(() => this.recentOtpSends.delete(rateLimitKey), 15000);

      return { message: 'Two-factor authentication enabled successfully. A test OTP has been sent to your email.' };
    } catch (error) {
      console.error('❌ Failed to send 2FA setup email:', error);
      // Don't fail the enable process if email fails
      return { message: 'Two-factor authentication enabled successfully. Note: Email delivery may have failed. Please check your email settings.' };
    }
  }

  async disable2fa(userId: number): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get security settings
    const securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: user.id.toString() },
    });

    if (!securitySettings || !securitySettings.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    securitySettings.twoFactorEnabled = false;
    await this.securitySettingsRepository.save(securitySettings);

    // Invalidate all existing 2FA OTPs for this user
    await this.twoFactorOtpRepository.update(
      { userId: user.id.toString(), used: false },
      { used: true },
    );

    return { message: 'Two-factor authentication disabled successfully' };
  }

  async get2faStatus(userId: number): Promise<TwoFactorStatusResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get security settings
    const securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: user.id.toString() },
    });

    return {
      enabled: securitySettings?.twoFactorEnabled || false,
      email: user.email,
    };
  }

  async testEmail(userId: number): Promise<{ success: boolean; message: string; error?: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.emailService.sendTestEmail(user.email);
  }
}

