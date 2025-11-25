import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WebPushService } from './web-push.service';
import { NotificationSettings } from '../entities/notification-settings.entity';
import * as webpush from 'web-push';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  clickAction?: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  constructor(
    private webPushService: WebPushService,
    private configService: ConfigService,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
  ) {}

  /**
   * Convert relative URL to absolute URL
   */
  private getAbsoluteUrl(url: string): string {
    // If already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Get frontend URL from config or use default
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://leadsflowforefoldai.com';
    
    // Remove trailing slash from frontend URL
    const baseUrl = frontendUrl.replace(/\/$/, '');
    
    // Ensure URL starts with /
    const path = url.startsWith('/') ? url : `/${url}`;
    
    return `${baseUrl}${path}`;
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    console.log(`\n🔔 [PUSH NOTIFICATION] Attempting to send to user: ${userId}`);
    console.log(`   Title: "${payload.title}"`);
    console.log(`   Body: "${payload.body}"`);
    console.log(`   Click Action: ${payload.clickAction || '/'}`);
    
    try {
      // Check if Web Push is initialized
      if (!this.webPushService.isInitialized()) {
        console.log(`❌ [PUSH NOTIFICATION] Web Push not initialized. Skipping push notification for user ${userId}.`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Web Push is initialized`);

      // Get user's notification settings
      const settings = await this.notificationSettingsRepository.findOne({
        where: { userId },
      });

      if (!settings) {
        console.log(`❌ [PUSH NOTIFICATION] No notification settings found for user ${userId}`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Notification settings found for user ${userId}`);

      // Check if browser push is enabled
      if (!settings.browserPush) {
        console.log(`⏭️  [PUSH NOTIFICATION] Browser push disabled for user ${userId}`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Browser push enabled for user ${userId}`);

      // Check if user has a push subscription
      if (!settings.pushSubscription) {
        console.log(`⏭️  [PUSH NOTIFICATION] No push subscription for user ${userId}`);
        return false;
      }

      // Parse the subscription (it should be a JSON string with web-push subscription object)
      let subscription: webpush.PushSubscription;
      try {
        subscription = JSON.parse(settings.pushSubscription);
        console.log(`✓ [PUSH NOTIFICATION] Web Push subscription parsed from JSON for user ${userId}`);
      } catch (error) {
        // Check if it's an old FCM token format (plain string)
        const subscriptionStr = settings.pushSubscription.trim();
        if (!subscriptionStr.startsWith('{') && !subscriptionStr.startsWith('[')) {
          console.log(`⚠️  [PUSH NOTIFICATION] Old FCM token format detected for user ${userId}`);
          console.log(`   The stored subscription appears to be an old Firebase token.`);
          console.log(`   Clearing old subscription. User needs to re-subscribe with web-push.`);
          // Clear the old subscription
          await this.clearPushSubscription(userId);
          return false;
        }
        console.log(`❌ [PUSH NOTIFICATION] Invalid subscription format for user ${userId}`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Subscription preview: ${settings.pushSubscription.substring(0, 50)}...`);
        return false;
      }

      // Validate subscription object
      if (!subscription.endpoint || !subscription.keys) {
        console.log(`❌ [PUSH NOTIFICATION] Invalid subscription object for user ${userId}`);
        console.log(`   Missing endpoint or keys. Clearing invalid subscription.`);
        await this.clearPushSubscription(userId);
        return false;
      }

      // Convert click action to absolute URL
      const clickUrl = this.getAbsoluteUrl(payload.clickAction || '/');
      
      // Create notification payload
      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/logo.png',
        badge: '/logo.png',
        tag: 'lead-notification',
        requireInteraction: true,
        data: {
          url: clickUrl,
          ...payload.data,
        },
      });

      console.log(`📤 [PUSH NOTIFICATION] Sending message via Web Push...`);
      await this.webPushService.sendNotification(subscription, notificationPayload);
      console.log(`✅ [PUSH NOTIFICATION] Push notification sent successfully to user ${userId}`);
      return true;
    } catch (error) {
      // Handle invalid subscription errors
      if (error.message === 'INVALID_SUBSCRIPTION') {
        console.log(`⚠️  [PUSH NOTIFICATION] Invalid subscription for user ${userId}. Clearing subscription.`);
        // Clear invalid subscription
        await this.clearPushSubscription(userId);
      } else {
        console.error(`❌ [PUSH NOTIFICATION] Failed to send push notification to user ${userId}`);
        console.error(`   Error: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToMultipleUsers(
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<{ successCount: number; failureCount: number }> {
    console.log(`\n📢 [PUSH NOTIFICATION BULK] Sending to ${userIds.length} users`);
    console.log(`   Title: "${payload.title}"`);
    
    let successCount = 0;
    let failureCount = 0;

    const results = await Promise.allSettled(
      userIds.map((userId) => this.sendToUser(userId, payload)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    console.log(`\n📊 [PUSH NOTIFICATION BULK] Results:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failure: ${failureCount}`);

    return { successCount, failureCount };
  }

  /**
   * Save or update user's Web Push subscription
   */
  async savePushSubscription(userId: string, subscription: string | webpush.PushSubscription): Promise<void> {
    console.log(`\n💾 [PUSH SUBSCRIPTION] Saving Web Push subscription for user ${userId}`);
    
    // Ensure subscription is a JSON string
    const subscriptionJson = typeof subscription === 'string' 
      ? subscription 
      : JSON.stringify(subscription);
    
    // Validate subscription format
    try {
      const parsed = JSON.parse(subscriptionJson);
      if (!parsed.endpoint) {
        throw new Error('Missing endpoint in subscription');
      }
      if (!parsed.keys) {
        throw new Error('Missing keys in subscription');
      }
      if (!parsed.keys.p256dh) {
        throw new Error('Missing p256dh key in subscription');
      }
      if (!parsed.keys.auth) {
        throw new Error('Missing auth key in subscription');
      }
      console.log(`   Endpoint: ${parsed.endpoint.substring(0, 50)}...`);
      console.log(`   Keys present: p256dh=${!!parsed.keys.p256dh}, auth=${!!parsed.keys.auth}`);
    } catch (error) {
      console.error(`❌ [PUSH SUBSCRIPTION] Invalid subscription format: ${error.message}`);
      throw new Error(`Invalid push subscription format: ${error.message}`);
    }
    
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      console.log(`   Creating new notification settings for user ${userId}`);
      settings = this.notificationSettingsRepository.create({
        userId,
        browserPush: true, // Enable by default when user subscribes
        pushSubscription: subscriptionJson,
      });
    } else {
      console.log(`   Updating existing notification settings for user ${userId}`);
      settings.pushSubscription = subscriptionJson;
      settings.browserPush = true; // Enable when updating subscription
    }

    await this.notificationSettingsRepository.save(settings);
    console.log(`✅ [PUSH SUBSCRIPTION] Push subscription saved successfully for user ${userId}`);
    console.log(`   Browser push enabled: ${settings.browserPush}`);
  }

  /**
   * Clear user's Web Push subscription
   */
  async clearPushSubscription(userId: string): Promise<void> {
    console.log(`\n🗑️  [PUSH SUBSCRIPTION] Clearing Web Push subscription for user ${userId}`);
    
    const settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (settings) {
      settings.pushSubscription = undefined;
      settings.browserPush = false;
      await this.notificationSettingsRepository.save(settings);
      console.log(`✅ [PUSH SUBSCRIPTION] Push subscription cleared successfully for user ${userId}`);
      console.log(`   Browser push disabled: ${settings.browserPush}`);
    } else {
      console.log(`⏭️  [PUSH SUBSCRIPTION] No settings found for user ${userId}, nothing to clear`);
    }
  }

  /**
   * Send notification for new lead
   */
  async sendNewLeadNotification(
    userId: string,
    leadName: string,
    leadId: number,
  ): Promise<boolean> {
    console.log(`\n🎯 [NEW LEAD NOTIFICATION] Preparing notification for user ${userId}`);
    console.log(`   Lead Name: ${leadName}`);
    console.log(`   Lead ID: ${leadId}`);
    
    return this.sendToUser(userId, {
      title: '🎯 New Lead Added',
      body: `${leadName} has been added to your leads`,
      icon: '/logo.png',
      clickAction: 'https://leadsflowforefoldai.com',
      data: {
        type: 'new_lead',
        leadId: leadId.toString(),
      },
    });
  }

  /**
   * Send notification for follow-up reminder
   */
  async sendFollowUpNotification(
    userId: string,
    leadName: string,
    leadId: number,
    followUpDate: Date | string,
  ): Promise<boolean> {
    console.log(`\n⏰ [FOLLOW-UP NOTIFICATION] Preparing notification for user ${userId}`);
    console.log(`   Lead Name: ${leadName}`);
    console.log(`   Lead ID: ${leadId}`);
    
    // Ensure followUpDate is a Date object
    const dateObj = followUpDate instanceof Date ? followUpDate : new Date(followUpDate);
    console.log(`   Follow-up Date: ${dateObj.toISOString()}`);
    
    return this.sendToUser(userId, {
      title: '⏰ Follow-up Reminder',
      body: `Follow-up with ${leadName} is scheduled for today`,
      icon: '/logo.png',
      clickAction: 'https://leadsflowforefoldai.com',
      data: {
        type: 'follow_up',
        leadId: leadId.toString(),
        followUpDate: dateObj.toISOString(),
      },
    });
  }

  /**
   * Get notification diagnostics for a user
   */
  async getNotificationDiagnostics(userId: string): Promise<{
    webPushInitialized: boolean;
    hasNotificationSettings: boolean;
    browserPushEnabled: boolean;
    hasPushSubscription: boolean;
    subscriptionPreview?: string;
    issues: string[];
  }> {
    const diagnostics = {
      webPushInitialized: false,
      hasNotificationSettings: false,
      browserPushEnabled: false,
      hasPushSubscription: false,
      subscriptionPreview: undefined as string | undefined,
      issues: [] as string[],
    };

    // Check Web Push initialization
    diagnostics.webPushInitialized = this.webPushService.isInitialized();
    if (!diagnostics.webPushInitialized) {
      diagnostics.issues.push('Web Push is not initialized. Check VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables.');
    }

    // Check notification settings
    const settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      diagnostics.issues.push('No notification settings found. User needs to subscribe first.');
      return diagnostics;
    }

    diagnostics.hasNotificationSettings = true;
    diagnostics.browserPushEnabled = settings.browserPush || false;
    diagnostics.hasPushSubscription = !!settings.pushSubscription;

    if (settings.pushSubscription) {
      try {
        const parsed = JSON.parse(settings.pushSubscription);
        if (parsed.endpoint) {
          diagnostics.subscriptionPreview = `${parsed.endpoint.substring(0, 30)}...`;
          
          // Validate subscription format
          if (!parsed.keys || !parsed.keys.p256dh || !parsed.keys.auth) {
            diagnostics.issues.push('Push subscription is missing required keys (p256dh or auth). Please re-subscribe.');
          }
        } else {
          diagnostics.issues.push('Push subscription is missing endpoint. Please re-subscribe.');
        }
      } catch (error) {
        // Check if it's an old FCM token format
        const subscriptionStr = settings.pushSubscription.trim();
        if (!subscriptionStr.startsWith('{') && !subscriptionStr.startsWith('[')) {
          diagnostics.issues.push('Old FCM token format detected. Please re-subscribe with web-push subscription.');
        } else {
          diagnostics.issues.push('Push subscription has invalid JSON format. Please re-subscribe.');
        }
        diagnostics.subscriptionPreview = settings.pushSubscription.substring(0, 30) + '...';
      }
    }

    if (!diagnostics.browserPushEnabled) {
      diagnostics.issues.push('Browser push is disabled. Enable it in notification settings.');
    }

    if (!diagnostics.hasPushSubscription) {
      diagnostics.issues.push('No push subscription found. User needs to subscribe to push notifications from the frontend.');
    }

    return diagnostics;
  }

  /**
   * Send daily summary notification
   */
  async sendDailySummaryNotification(
    userId: string,
    summary: {
      newLeads: number;
      followUps: number;
      hotLeads: number;
    },
  ): Promise<boolean> {
    console.log(`\n📊 [DAILY SUMMARY NOTIFICATION] Preparing notification for user ${userId}`);
    console.log(`   New Leads: ${summary.newLeads}`);
    console.log(`   Follow-ups: ${summary.followUps}`);
    console.log(`   Hot Leads: ${summary.hotLeads}`);
    
    const body = `${summary.newLeads} new leads, ${summary.followUps} follow-ups, ${summary.hotLeads} hot leads`;
    
    return this.sendToUser(userId, {
      title: '📊 Daily Lead Summary',
      body,
      icon: '/logo.png',
      clickAction: 'https://leadsflowforefoldai.com',
      data: {
        type: 'daily_summary',
        ...Object.fromEntries(
          Object.entries(summary).map(([key, value]) => [key, value.toString()]),
        ),
      },
    });
  }
}

