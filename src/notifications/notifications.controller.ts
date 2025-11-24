import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { PushNotificationService } from './push-notification.service';
import { SaveFcmTokenDto } from './dto/save-fcm-token.dto';

@Controller('notifications')
@UseGuards(TokenAuthGuard)
export class NotificationsController {
  constructor(private pushNotificationService: PushNotificationService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribeToPushNotifications(
    @Request() req,
    @Body() saveTokenDto: SaveFcmTokenDto,
  ) {
    const userId = req.user.sub.toString();
    await this.pushNotificationService.savePushSubscription(
      userId,
      saveTokenDto.token,
    );

    return {
      message: 'Push notification subscription saved successfully',
    };
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribeFromPushNotifications(@Request() req) {
    const userId = req.user.sub.toString();
    await this.pushNotificationService.clearPushSubscription(userId);

    return {
      message: 'Push notification subscription removed successfully',
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestNotification(@Request() req) {
    const userId = req.user.sub.toString();
    const success = await this.pushNotificationService.sendToUser(userId, {
      title: '🔔 Test Notification',
      body: 'This is a test push notification from Lead Management System',
      icon: '/logo.png',
      clickAction: '/dashboard',
      data: {
        type: 'test',
      },
    });

    if (success) {
      return {
        message: 'Test notification sent successfully',
      };
    } else {
      return {
        message: 'Failed to send test notification. Please check your settings.',
      };
    }
  }
}

