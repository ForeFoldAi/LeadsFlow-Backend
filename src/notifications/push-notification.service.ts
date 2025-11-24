import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseService } from './firebase.service';
import { NotificationSettings } from '../entities/notification-settings.entity';
import * as admin from 'firebase-admin';

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
    private firebaseService: FirebaseService,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
  ) {}

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    console.log(`\n🔔 [PUSH NOTIFICATION] Attempting to send to user: ${userId}`);
    console.log(`   Title: "${payload.title}"`);
    console.log(`   Body: "${payload.body}"`);
    console.log(`   Click Action: ${payload.clickAction || '/'}`);
    
    try {
      // Check if Firebase is initialized
      if (!this.firebaseService.isInitialized()) {
        console.log(`❌ [PUSH NOTIFICATION] Firebase not initialized. Skipping push notification for user ${userId}.`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Firebase is initialized`);

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

      // Check if user has a push subscription token
      if (!settings.pushSubscription) {
        console.log(`⏭️  [PUSH NOTIFICATION] No push subscription token for user ${userId}`);
        return false;
      }

      // Parse the subscription (it might be a JSON string or just the token)
      let token: string;
      try {
        const parsed = JSON.parse(settings.pushSubscription);
        token = parsed.token || parsed.fcmToken || settings.pushSubscription;
        console.log(`✓ [PUSH NOTIFICATION] FCM token parsed from JSON for user ${userId}`);
      } catch {
        token = settings.pushSubscription;
        console.log(`✓ [PUSH NOTIFICATION] Using raw FCM token for user ${userId}`);
      }
      console.log(`   Token: ${token.substring(0, 20)}...${token.substring(token.length - 20)}`);

      // Send notification via Firebase Cloud Messaging
      const messaging = this.firebaseService.getMessaging();
      if (!messaging) {
        console.log(`❌ [PUSH NOTIFICATION] Firebase messaging not available for user ${userId}`);
        return false;
      }
      console.log(`✓ [PUSH NOTIFICATION] Firebase messaging service ready`);

      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          clickAction: payload.clickAction || '/',
          ...payload.data,
        },
        webpush: {
          fcmOptions: {
            link: payload.clickAction || '/',
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon,
            requireInteraction: true,
            tag: 'lead-notification',
          },
        },
      };

      console.log(`📤 [PUSH NOTIFICATION] Sending message via FCM...`);
      const response = await messaging.send(message);
      console.log(`✅ [PUSH NOTIFICATION] Push notification sent successfully to user ${userId}`);
      console.log(`   FCM Response: ${response}`);
      return true;
    } catch (error) {
      // Handle invalid token errors
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.log(`⚠️  [PUSH NOTIFICATION] Invalid FCM token for user ${userId}. Clearing token.`);
        console.log(`   Error Code: ${error.code}`);
        // Clear invalid token
        await this.clearPushSubscription(userId);
      } else {
        console.error(`❌ [PUSH NOTIFICATION] Failed to send push notification to user ${userId}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Error Code: ${error.code || 'N/A'}`);
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
   * Save or update user's FCM token
   */
  async savePushSubscription(userId: string, token: string): Promise<void> {
    console.log(`\n💾 [PUSH SUBSCRIPTION] Saving FCM token for user ${userId}`);
    console.log(`   Token: ${token.substring(0, 20)}...${token.substring(token.length - 20)}`);
    
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      console.log(`   Creating new notification settings for user ${userId}`);
      settings = this.notificationSettingsRepository.create({
        userId,
        browserPush: true, // Enable by default when user subscribes
        pushSubscription: token,
      });
    } else {
      console.log(`   Updating existing notification settings for user ${userId}`);
      settings.pushSubscription = token;
      settings.browserPush = true; // Enable when updating token
    }

    await this.notificationSettingsRepository.save(settings);
    console.log(`✅ [PUSH SUBSCRIPTION] Push subscription saved successfully for user ${userId}`);
    console.log(`   Browser push enabled: ${settings.browserPush}`);
  }

  /**
   * Clear user's FCM token
   */
  async clearPushSubscription(userId: string): Promise<void> {
    console.log(`\n🗑️  [PUSH SUBSCRIPTION] Clearing FCM token for user ${userId}`);
    
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
      clickAction: `/leads/${leadId}`,
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
      clickAction: `/leads/${leadId}`,
      data: {
        type: 'follow_up',
        leadId: leadId.toString(),
        followUpDate: dateObj.toISOString(),
      },
    });
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
      clickAction: '/dashboard',
      data: {
        type: 'daily_summary',
        ...Object.fromEntries(
          Object.entries(summary).map(([key, value]) => [key, value.toString()]),
        ),
      },
    });
  }
}

