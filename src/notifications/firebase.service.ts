import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    // Log Firebase configuration (without private key) for debugging
    console.log('🔥 Firebase Configuration:');
    console.log(`   Project ID: ${projectId || 'NOT SET'}`);
    console.log(`   Client Email: ${clientEmail || 'NOT SET'}`);
    console.log(`   Private Key: ${privateKey ? '****' + privateKey.slice(-20) : 'NOT SET'}`);

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  Firebase credentials not configured. Push notifications will be disabled.');
      return;
    }

    try {
      // Replace escaped newlines with actual newlines
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });

      console.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    }
  }

  getMessaging(): admin.messaging.Messaging | null {
    if (!this.firebaseApp) {
      return null;
    }
    return admin.messaging(this.firebaseApp);
  }

  isInitialized(): boolean {
    return !!this.firebaseApp;
  }
}

