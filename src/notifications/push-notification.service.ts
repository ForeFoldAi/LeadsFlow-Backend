import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WebPushService } from './web-push.service';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
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
    @InjectRepository(PushSubscription)
    private pushSubscriptionRepository: Repository<PushSubscription>,
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
   * Send push notification to a specific user (sends to all their devices)
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

      // Get all push subscriptions for this user
      const subscriptions = await this.pushSubscriptionRepository.find({
        where: { userId },
      });

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`⏭️  [PUSH NOTIFICATION] No push subscriptions found for user ${userId}`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Found ${subscriptions.length} subscription(s) for user ${userId}`);

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

      // Send to all subscriptions
      let successCount = 0;
      let failureCount = 0;

      for (const subRecord of subscriptions) {
        try {
          // Parse the subscription
          let subscription: webpush.PushSubscription;
          try {
            subscription = JSON.parse(subRecord.subscriptionData);
          } catch (error) {
            console.log(`⚠️  [PUSH NOTIFICATION] Invalid subscription format for endpoint ${subRecord.endpoint.substring(0, 50)}...`);
            // Remove invalid subscription
            await this.pushSubscriptionRepository.remove(subRecord);
            failureCount++;
            continue;
          }

          // Validate subscription object
          if (!subscription.endpoint || !subscription.keys) {
            console.log(`⚠️  [PUSH NOTIFICATION] Invalid subscription object for endpoint ${subRecord.endpoint.substring(0, 50)}...`);
            // Remove invalid subscription
            await this.pushSubscriptionRepository.remove(subRecord);
            failureCount++;
            continue;
          }

          console.log(`📤 [PUSH NOTIFICATION] Sending to device: ${subRecord.deviceInfo || 'unknown'} (${subRecord.endpoint.substring(0, 50)}...)`);
          await this.webPushService.sendNotification(subscription, notificationPayload);
          successCount++;
          console.log(`✅ [PUSH NOTIFICATION] Sent successfully to device`);
        } catch (error) {
          // Handle invalid subscription errors
          if (error.message === 'INVALID_SUBSCRIPTION') {
            console.log(`⚠️  [PUSH NOTIFICATION] Invalid subscription for endpoint ${subRecord.endpoint.substring(0, 50)}... Removing.`);
            await this.pushSubscriptionRepository.remove(subRecord);
          } else {
            console.error(`❌ [PUSH NOTIFICATION] Failed to send to device: ${error.message}`);
          }
          failureCount++;
        }
      }

      console.log(`\n📊 [PUSH NOTIFICATION] Results for user ${userId}:`);
      console.log(`   ✅ Success: ${successCount}`);
      console.log(`   ❌ Failure: ${failureCount}`);

      // If we have at least one successful send, return true
      return successCount > 0;
    } catch (error) {
      console.error(`❌ [PUSH NOTIFICATION] Failed to send push notification to user ${userId}`);
      console.error(`   Error: ${error.message}`);
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
   * Save or update user's Web Push subscription (supports multiple devices)
   */
  async savePushSubscription(
    userId: string, 
    subscription: string | webpush.PushSubscription | { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceInfo?: string
  ): Promise<void> {
    console.log(`\n💾 [PUSH SUBSCRIPTION] Saving Web Push subscription for user ${userId}`);
    
    // Convert subscription to JSON string
    let subscriptionJson: string;
    if (typeof subscription === 'string') {
      subscriptionJson = subscription;
    } else if ('endpoint' in subscription && 'keys' in subscription) {
      // It's a subscription object (DTO or webpush.PushSubscription)
      subscriptionJson = JSON.stringify(subscription);
    } else {
      throw new Error('Invalid subscription format');
    }
    
    // Validate subscription format
    let parsed: webpush.PushSubscription;
    try {
      parsed = JSON.parse(subscriptionJson);
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
      console.log(`   Device: ${deviceInfo || 'unknown'}`);
      console.log(`   Keys present: p256dh=${!!parsed.keys.p256dh}, auth=${!!parsed.keys.auth}`);
    } catch (error) {
      console.error(`❌ [PUSH SUBSCRIPTION] Invalid subscription format: ${error.message}`);
      throw new Error(`Invalid push subscription format: ${error.message}`);
    }
    
    // Check if subscription already exists for this endpoint
    let existingSub = await this.pushSubscriptionRepository.findOne({
      where: { endpoint: parsed.endpoint },
    });

    if (existingSub) {
      // Update existing subscription (in case keys changed or device info updated)
      console.log(`   Updating existing subscription for endpoint`);
      existingSub.subscriptionData = subscriptionJson;
      existingSub.userId = userId;
      if (deviceInfo) {
        existingSub.deviceInfo = deviceInfo;
      }
      await this.pushSubscriptionRepository.save(existingSub);
    } else {
      // Create new subscription
      console.log(`   Creating new subscription for endpoint`);
      const newSub = this.pushSubscriptionRepository.create({
        endpoint: parsed.endpoint,
        userId,
        subscriptionData: subscriptionJson,
        deviceInfo: deviceInfo || undefined,
      });
      await this.pushSubscriptionRepository.save(newSub);
    }

    // Ensure notification settings exist and browserPush is enabled
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      console.log(`   Creating new notification settings for user ${userId}`);
      settings = this.notificationSettingsRepository.create({
        userId,
        browserPush: true, // Enable by default when user subscribes
      });
    } else {
      console.log(`   Enabling browser push for user ${userId}`);
      settings.browserPush = true; // Enable when adding subscription
    }

    await this.notificationSettingsRepository.save(settings);
    console.log(`✅ [PUSH SUBSCRIPTION] Push subscription saved successfully for user ${userId}`);
    console.log(`   Browser push enabled: ${settings.browserPush}`);
  }

  /**
   * Clear user's Web Push subscription(s)
   * If endpoint is provided, only clears that specific subscription
   * If endpoint is not provided, clears all subscriptions for the user
   */
  async clearPushSubscription(userId: string, endpoint?: string): Promise<void> {
    console.log(`\n🗑️  [PUSH SUBSCRIPTION] Clearing Web Push subscription for user ${userId}`);
    if (endpoint) {
      console.log(`   Endpoint: ${endpoint.substring(0, 50)}...`);
    } else {
      console.log(`   Clearing all subscriptions for user`);
    }
    
    if (endpoint) {
      // Clear specific subscription
      const subscription = await this.pushSubscriptionRepository.findOne({
        where: { endpoint, userId },
      });

      if (subscription) {
        await this.pushSubscriptionRepository.remove(subscription);
        console.log(`✅ [PUSH SUBSCRIPTION] Removed subscription for endpoint`);
        
        // Check if user has any remaining subscriptions
        const remainingSubs = await this.pushSubscriptionRepository.count({
          where: { userId },
        });

        if (remainingSubs === 0) {
          // No more subscriptions, disable browser push
          const settings = await this.notificationSettingsRepository.findOne({
            where: { userId },
          });
          if (settings) {
            settings.browserPush = false;
            await this.notificationSettingsRepository.save(settings);
            console.log(`   Browser push disabled (no remaining subscriptions)`);
          }
        }
      } else {
        console.log(`⏭️  [PUSH SUBSCRIPTION] Subscription not found for endpoint`);
      }
    } else {
      // Clear all subscriptions for user
      const subscriptions = await this.pushSubscriptionRepository.find({
        where: { userId },
      });

      if (subscriptions.length > 0) {
        await this.pushSubscriptionRepository.remove(subscriptions);
        console.log(`✅ [PUSH SUBSCRIPTION] Removed ${subscriptions.length} subscription(s)`);
      }

      // Disable browser push
      const settings = await this.notificationSettingsRepository.findOne({
        where: { userId },
      });

      if (settings) {
        settings.browserPush = false;
        await this.notificationSettingsRepository.save(settings);
        console.log(`   Browser push disabled`);
      }
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
   * If browserPush is true, sends browser push notification automatically
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
    
    // If browserPush is enabled, sendToUser will handle all checks (browserPush, subscription, etc.)
    // No need to check followUps - if browserPush is true, send browser notifications
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
    subscriptionCount: number;
    subscriptionPreview?: string;
    issues: string[];
  }> {
    const diagnostics = {
      webPushInitialized: false,
      hasNotificationSettings: false,
      browserPushEnabled: false,
      hasPushSubscription: false,
      subscriptionCount: 0,
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

    // Check push subscriptions from new entity
    const subscriptions = await this.pushSubscriptionRepository.find({
      where: { userId },
    });

    diagnostics.subscriptionCount = subscriptions.length;
    diagnostics.hasPushSubscription = subscriptions.length > 0;

    if (subscriptions.length > 0) {
      // Use first subscription for preview
      try {
        const parsed = JSON.parse(subscriptions[0].subscriptionData);
        if (parsed.endpoint) {
          diagnostics.subscriptionPreview = `${parsed.endpoint.substring(0, 30)}... (${subscriptions.length} device${subscriptions.length > 1 ? 's' : ''})`;
          
          // Validate subscription format
          if (!parsed.keys || !parsed.keys.p256dh || !parsed.keys.auth) {
            diagnostics.issues.push('Push subscription is missing required keys (p256dh or auth). Please re-subscribe.');
          }
        } else {
          diagnostics.issues.push('Push subscription is missing endpoint. Please re-subscribe.');
        }
      } catch (error) {
        diagnostics.issues.push('Push subscription has invalid JSON format. Please re-subscribe.');
        diagnostics.subscriptionPreview = `Invalid format (${subscriptions.length} device${subscriptions.length > 1 ? 's' : ''})`;
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

