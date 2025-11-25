import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

@Injectable()
export class WebPushService implements OnModuleInit {
  private vapidPublicKey: string | undefined;
  private vapidPrivateKey: string | undefined;
  private vapidSubject: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    this.vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    this.vapidSubject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:contact@forefoldai.com';

    // Log VAPID configuration (without private key) for debugging
    console.log('🔔 Web Push Configuration:');
    console.log(`   VAPID Public Key: ${this.vapidPublicKey ? this.vapidPublicKey.substring(0, 20) + '...' : 'NOT SET'}`);
    console.log(`   VAPID Private Key: ${this.vapidPrivateKey ? '****' + this.vapidPrivateKey.slice(-20) : 'NOT SET'}`);
    console.log(`   VAPID Subject: ${this.vapidSubject || 'NOT SET'}`);

    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.warn('⚠️  VAPID credentials not configured. Push notifications will be disabled.');
      console.warn('   Generate VAPID keys using: npx web-push generate-vapid-keys');
      return;
    }

    try {
      // Set VAPID details for web-push
      webpush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );

      console.log('✅ Web Push (VAPID) initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Web Push:', error.message);
    }
  }

  /**
   * Get VAPID public key (needed by frontend to subscribe)
   */
  getVapidPublicKey(): string | null {
    return this.vapidPublicKey || null;
  }

  /**
   * Send push notification
   */
  async sendNotification(
    subscription: webpush.PushSubscription,
    payload: string,
  ): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('Web Push is not initialized. Check VAPID credentials.');
    }

    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      // Handle specific error codes
      if (error.statusCode === 410) {
        // Subscription expired or invalid
        throw new Error('INVALID_SUBSCRIPTION');
      } else if (error.statusCode === 429) {
        // Too many requests
        throw new Error('RATE_LIMIT');
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if web push is initialized
   */
  isInitialized(): boolean {
    return !!(this.vapidPublicKey && this.vapidPrivateKey);
  }
}

