import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { User } from '../entities/user.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { SecuritySettings } from '../entities/security-settings.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPreferences,
      NotificationSettings,
      SecuritySettings,
      UserPermissions,
    ]),
    AuthModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}

