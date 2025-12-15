import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { WebPushService } from './web-push.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationSettings, PushSubscription]),
    AuthModule, // Import AuthModule to use TokenAuthGuard
  ],
  controllers: [NotificationsController],
  providers: [WebPushService, PushNotificationService],
  exports: [PushNotificationService, WebPushService],
})
export class NotificationsModule {}

