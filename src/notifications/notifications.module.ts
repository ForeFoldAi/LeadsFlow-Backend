import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { FirebaseService } from './firebase.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationSettings]),
    AuthModule, // Import AuthModule to use TokenAuthGuard
  ],
  controllers: [NotificationsController],
  providers: [FirebaseService, PushNotificationService],
  exports: [PushNotificationService, FirebaseService],
})
export class NotificationsModule {}

