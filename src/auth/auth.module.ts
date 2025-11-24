import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { Token } from '../entities/token.entity';
import { PasswordReset } from '../entities/otp.entity';
import { TwoFactorOtp } from '../entities/two-factor-otp.entity';
import { SecuritySettings } from '../entities/security-settings.entity';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { TokenAuthGuard } from './guards/token-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Token, PasswordReset, TwoFactorOtp, SecuritySettings])],
  controllers: [AuthController],
  providers: [AuthService, TokenService, EmailService, TokenAuthGuard],
  exports: [AuthService, TokenService, TokenAuthGuard, EmailService],
})
export class AuthModule {}

