import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsScheduler } from './leads.scheduler';
import { Lead } from '../entities/lead.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { CustomSector } from '../entities/custom-sector.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, User, UserPermissions, NotificationSettings, CustomSector]),
    AuthModule, // Import AuthModule to use TokenAuthGuard and EmailService
    NotificationsModule, // Import NotificationsModule for push notifications
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsScheduler],
  exports: [LeadsService],
})
export class LeadsModule {}

