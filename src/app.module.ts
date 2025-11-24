import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationsModule } from './notifications/notifications.module';
import { User } from './entities/user.entity';
import { Token } from './entities/token.entity';
import { Lead } from './entities/lead.entity';
import { PasswordReset } from './entities/otp.entity';
import { TwoFactorOtp } from './entities/two-factor-otp.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { SecuritySettings } from './entities/security-settings.entity';
import { UserPermissions } from './entities/user-permissions.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(), // Enable cron job scheduling for follow-up reminders
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined in environment variables');
        }

        // Parse PostgreSQL connection URL
        const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
        const match = databaseUrl.match(urlPattern);

        if (!match) {
          throw new Error('Invalid DATABASE_URL format');
        }

        return {
          type: 'postgres',
          host: match[3],
          port: parseInt(match[4], 10),
          username: match[1],
          password: match[2],
          database: match[5],
          entities: [
            User,
            Token,
            Lead,
            PasswordReset,
            TwoFactorOtp,
            UserPreferences,
            NotificationSettings,
            SecuritySettings,
            UserPermissions,
          ],
          synchronize: false, // Disabled - database already exists
          logging: process.env.NODE_ENV === 'development',
          ssl: {
            rejectUnauthorized: false, // For AWS RDS - accepts self-signed certificates
          },
        };
      },
    }),
    AuthModule,
    UsersModule,
    LeadsModule,
    AnalyticsModule,
    ProfileModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
