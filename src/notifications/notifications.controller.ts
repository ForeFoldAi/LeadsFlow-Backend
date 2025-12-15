import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { PushNotificationService } from './push-notification.service';
import { SavePushSubscriptionDto } from './dto/save-fcm-token.dto';
import { WebPushService } from './web-push.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private pushNotificationService: PushNotificationService,
    private webPushService: WebPushService,
  ) {}

  @Get('vapid-public-key')
  @HttpCode(HttpStatus.OK)
  async getVapidPublicKey() {
    const publicKey = this.webPushService.getVapidPublicKey();
    if (!publicKey) {
      return {
        error: 'VAPID public key not configured',
      };
    }
    return {
      publicKey,
    };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TokenAuthGuard)
  async subscribeToPushNotifications(
    @Request() req,
    @Body() subscriptionDto: SavePushSubscriptionDto,
  ) {
    const userId = req.user.sub.toString();
    
    try {
      console.log(`[NOTIFICATIONS CONTROLLER] Subscribe request for user ${userId}`);
      console.log(`[NOTIFICATIONS CONTROLLER] Subscription data:`, {
        endpoint: subscriptionDto.endpoint?.substring(0, 50) + '...',
        hasKeys: !!subscriptionDto.keys,
        hasP256dh: !!subscriptionDto.keys?.p256dh,
        hasAuth: !!subscriptionDto.keys?.auth,
      });
      
      await this.pushNotificationService.savePushSubscription(
        userId,
        subscriptionDto,
        subscriptionDto.deviceInfo,
      );

      return {
        success: true,
        message: 'Push notification subscription saved successfully',
      };
    } catch (error) {
      console.error(`[NOTIFICATIONS CONTROLLER] Error saving subscription:`, error);
      return {
        success: false,
        message: error.message || 'Failed to save push subscription',
        error: error.message,
      };
    }
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TokenAuthGuard)
  async unsubscribeFromPushNotifications(
    @Request() req,
    @Body() body?: { endpoint?: string },
  ) {
    const userId = req.user.sub.toString();
    const endpoint = body?.endpoint;
    
    await this.pushNotificationService.clearPushSubscription(userId, endpoint);

    return {
      message: endpoint 
        ? 'Push notification subscription removed successfully for this device'
        : 'All push notification subscriptions removed successfully',
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TokenAuthGuard)
  async sendTestNotification(@Request() req) {
    const userId = req.user.sub.toString();
    
    // Get detailed diagnostic information first
    const diagnostics = await this.pushNotificationService.getNotificationDiagnostics(userId);
    
    // Check if we can even attempt to send
    if (diagnostics.issues.length > 0) {
      return {
        success: false,
        message: 'Cannot send test notification. Please fix the following issues:',
        diagnostics,
        issues: diagnostics.issues,
      };
    }
    
    const success = await this.pushNotificationService.sendToUser(userId, {
      title: '🔔 Test Notification',
      body: 'This is a test push notification from Lead Management System',
      icon: '/logo.png',
      clickAction: 'https://leadsflowforefoldai.com',
      data: {
        type: 'test',
      },
    });

    if (success) {
      return {
        success: true,
        message: 'Test notification sent successfully',
        diagnostics,
      };
    } else {
      // Get updated diagnostics after failed attempt
      const updatedDiagnostics = await this.pushNotificationService.getNotificationDiagnostics(userId);
      return {
        success: false,
        message: 'Failed to send test notification. Please check your settings.',
        diagnostics: updatedDiagnostics,
        issues: updatedDiagnostics.issues,
      };
    }
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TokenAuthGuard)
  async getNotificationStatus(@Request() req) {
    const userId = req.user.sub.toString();
    const diagnostics = await this.pushNotificationService.getNotificationDiagnostics(userId);
    
    return {
      userId,
      ...diagnostics,
    };
  }
}

