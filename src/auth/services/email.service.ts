import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpSecure = this.configService.get<string>('SMTP_SECURE');
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    
    // Log SMTP configuration (without password) for debugging
    console.log('📧 SMTP Configuration:');
    console.log(`   Host: ${smtpHost || 'NOT SET'}`);
    console.log(`   Port: ${smtpPort || 'NOT SET'}`);
    console.log(`   Secure: ${smtpSecure || 'NOT SET'}`);
    console.log(`   User: ${smtpUser || 'NOT SET'}`);
    console.log(`   Password: ${this.configService.get<string>('SMTP_PASS') ? '****' + this.configService.get<string>('SMTP_PASS')?.slice(-4) : 'NOT SET'}`);
    
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort ? parseInt(smtpPort, 10) : 465,
      secure: smtpSecure === 'true' || smtpSecure === '1', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      // Add connection timeout and logging
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      debug: false, // Set to true for detailed logs
      logger: false, // Set to true for detailed logs
    });
  }

  /**
   * Get ForeFold branded email footer HTML
   * Includes logo, contact information, and company details
   */
  private getEmailFooter(): string {
    // Logo options (choose one):
    // Option 1: Public CDN URL (update with your actual logo URL)
    // const logoUrl = 'https://forefoldai.com/assets/logo.png';
    
    // Option 2: Self-hosted from your backend (if serving static files)
    // const logoUrl = `${this.configService.get<string>('BACKEND_URL')}/public/image.png`;
    
    // Option 3: Use text-based logo as fallback (current - most reliable for emails)
    const logoHtml = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #1a365d; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">
          ForeFold AI
        </h1>
        <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px; font-style: italic;">
          Crafting Digital Excellence
        </p>
      </div>
    `;
    
    return `
      <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e0e0e0;">
        ${logoHtml}
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-top: 20px;">
          <h3 style="color: #1a365d; margin-top: 0; margin-bottom: 15px; font-size: 18px; text-align: center;">Contact Us</h3>
          
          <p style="color: #4a5568; margin-bottom: 20px; text-align: center; line-height: 1.6;">
            Get in touch with us for expert consulting services and innovative web solutions tailored to your business needs.
          </p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; border-left: 4px solid #1a365d;">
            <p style="margin: 0 0 10px 0; color: #1a365d; font-weight: bold; font-size: 14px;">Contact Address</p>
            <p style="margin: 0 0 5px 0; color: #2d3748; font-size: 14px; line-height: 1.8;">
              <strong>ForeFold Consulting Services</strong><br />
              RV Fortune Nest, 2, Alkapoor Township,<br />
              Main Rd, Huda, Manikonda,<br />
              Hyderabad, Telangana, 500089<br />
              India
            </p>
            <p style="margin: 15px 0 0 0;">
              <a href="https://forefoldai.com" style="color: #1a365d; text-decoration: none; font-weight: 600; font-size: 14px;">
                🌐 https://forefoldai.com
              </a>
            </p>
            <p style="margin: 10px 0 0 0;">
              <a href="mailto:contact@forefoldai.com" style="color: #1a365d; text-decoration: none; font-size: 14px;">
                📧 contact@forefoldai.com
              </a>
            </p>
            <p style="margin: 10px 0 0 0; color: #2d3748; font-size: 14px;">
              📞 +91 83284 33976, +91 98481 35274
            </p>
          </div>
        </div>
        
        <p style="text-align: center; margin-top: 20px; color: #a0aec0; font-size: 11px;">
          © ${new Date().getFullYear()} ForeFold Consulting Services LLP. All rights reserved.
        </p>
      </div>
    `;
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'Password Reset OTP - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            <p>You have requested to reset your password. Please use the following OTP to verify your identity:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>. Please do not share this OTP with anyone.</p>
            <p>If you did not request this password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from LeadsFlow. Please do not reply to this email.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `Password Reset OTP: ${otp}\n\nThis OTP will expire in 10 minutes. If you did not request this password reset, please ignore this email.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendPasswordResetSuccess(email: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'Password Reset Successful - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Successful</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #28a745; margin-top: 0;">Password Reset Successful</h2>
            <p>Your password has been successfully reset.</p>
            <p>If you did not make this change, please contact support immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from LeadsFlow. Please do not reply to this email.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `Your password has been successfully reset. If you did not make this change, please contact support immediately.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw error for success notification
    }
  }

  async send2faOtp(email: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'Two-Factor Authentication OTP - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>2FA OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Two-Factor Authentication</h2>
            <p>You have requested to log in with two-factor authentication. Please use the following OTP to complete your login:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>. Please do not share this OTP with anyone.</p>
            <p>If you did not request this login, please ignore this email and secure your account.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from LeadsFlow. Please do not reply to this email.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `Two-Factor Authentication OTP: ${otp}\n\nThis OTP will expire in 10 minutes. If you did not request this login, please ignore this email and secure your account.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send 2FA OTP email');
    }
  }

  async send2faSetupConfirmation(email: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'Two-Factor Authentication Enabled - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>2FA Setup Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #28a745; margin-top: 0;">✅ Two-Factor Authentication Enabled!</h2>
            <p>Great news! Two-factor authentication has been successfully enabled for your LeadConnectaccount.</p>
            <p>From now on, you'll receive a one-time password (OTP) via email each time you log in.</p>
            
            <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #007bff;">Test Your Setup</h3>
              <p style="margin-bottom: 0;">Here's your first OTP to test the setup:</p>
            </div>
            
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #856404;">Security Tips:</h4>
              <ul style="margin-bottom: 0;">
                <li>Never share your OTP with anyone</li>
                <li>LeadConnectstaff will never ask for your OTP</li>
                <li>If you didn't enable 2FA, contact support immediately</li>
              </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from LeadsFlow. Please do not reply to this email.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `Two-Factor Authentication Enabled!\n\nTwo-factor authentication has been successfully enabled for your LeadsFlow account.\n\nTest OTP: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nSecurity Tips:\n- Never share your OTP with anyone\n- LeadsFlow staff will never ask for your OTP\n- If you didn't enable 2FA, contact support immediately`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending 2FA setup confirmation email:', error);
      throw new Error('Failed to send 2FA setup confirmation email');
    }
  }

  async sendNewLeadNotification(
    email: string,
    leadName: string,
    leadEmail?: string,
    leadPhone?: string,
    leadCompany?: string,
    createdBy?: string,
  ): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'New Lead Added - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Lead Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #007bff; margin-top: 0;">New Lead Added</h2>
            <p>A new lead has been added to your account:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Name:</strong> ${leadName}</p>
              ${leadEmail ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${leadEmail}</p>` : ''}
              ${leadPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${leadPhone}</p>` : ''}
              ${leadCompany ? `<p style="margin: 5px 0;"><strong>Company:</strong> ${leadCompany}</p>` : ''}
              ${createdBy ? `<p style="margin: 5px 0;"><strong>Added by:</strong> ${createdBy}</p>` : ''}
            </div>
            <p style="margin-top: 20px;">Please log in to your LeadsFlow account to view and manage this lead.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated notification from LeadsFlow. You can manage your notification preferences in your account settings.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `New Lead Added\n\nA new lead has been added to your account:\n\nName: ${leadName}${leadEmail ? `\nEmail: ${leadEmail}` : ''}${leadPhone ? `\nPhone: ${leadPhone}` : ''}${leadCompany ? `\nCompany: ${leadCompany}` : ''}${createdBy ? `\nAdded by: ${createdBy}` : ''}\n\nPlease log in to your LeadsFlow account to view and manage this lead.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending new lead notification email:', error);
      // Don't throw error - notification failures shouldn't break lead creation
    }
  }

  async sendFollowUpReminder(
    email: string,
    leadName: string,
    followUpDate: Date | string,
    leadEmail?: string,
    leadPhone?: string,
    leadCompany?: string,
    notes?: string,
  ): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    // Ensure followUpDate is a Date object
    const dateObj = followUpDate instanceof Date ? followUpDate : new Date(followUpDate);
    
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const mailOptions = {
      from: from,
      to: email,
      subject: 'Follow-up Reminder - LeadsFlow',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Follow-up Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #ff9800; margin-top: 0;">Follow-up Reminder</h2>
            <p>You have a scheduled follow-up for the following lead:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800;">
              <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${leadName}</p>
              <p style="margin: 10px 0 5px 0; color: #666;"><strong>Follow-up Date:</strong> ${formattedDate}</p>
              ${leadEmail ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${leadEmail}</p>` : ''}
              ${leadPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${leadPhone}</p>` : ''}
              ${leadCompany ? `<p style="margin: 5px 0;"><strong>Company:</strong> ${leadCompany}</p>` : ''}
              ${notes ? `<p style="margin: 10px 0 5px 0;"><strong>Notes:</strong></p><p style="margin: 5px 0; padding: 10px; background-color: #f9f9f9; border-radius: 3px;">${notes}</p>` : ''}
            </div>
            <p style="margin-top: 20px;">Don't forget to follow up with this lead. Log in to your LeadsFlow account to update the lead status.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated reminder from LeadsFlow. You can manage your notification preferences in your account settings.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `Follow-up Reminder\n\nYou have a scheduled follow-up for the following lead:\n\nName: ${leadName}\nFollow-up Date: ${formattedDate}${leadEmail ? `\nEmail: ${leadEmail}` : ''}${leadPhone ? `\nPhone: ${leadPhone}` : ''}${leadCompany ? `\nCompany: ${leadCompany}` : ''}${notes ? `\n\nNotes:\n${notes}` : ''}\n\nDon't forget to follow up with this lead. Log in to your LeadsFlow account to update the lead status.`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Follow-up reminder email sent successfully to ${email}. MessageId: ${info.messageId}`);
      return;
    } catch (error) {
      console.error(`❌ Error sending follow-up reminder email to ${email}:`, error);
      // Re-throw error so calling code can track failures properly
      throw new Error(`Failed to send follow-up reminder email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test SMTP connection and send a test email
   * Used for verifying email configuration
   */
  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; error?: string }> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    
    // First, verify the SMTP connection
    try {
      console.log('🔍 Testing SMTP connection...');
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return {
        success: false,
        message: 'SMTP connection failed',
        error: error.message || 'Unknown error',
      };
    }

    // If connection is good, try sending a test email
    const mailOptions = {
      from: from,
      to: toEmail,
      subject: '✅ Test Email - LeadConnectSMTP Configuration',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #28a745; margin-top: 0;">✅ SMTP Configuration Successful!</h2>
            <p>Congratulations! Your email configuration is working correctly.</p>
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0;"><strong>Your LeadConnectemail system is ready to:</strong></p>
              <ul style="margin: 10px 0;">
                <li>Send Two-Factor Authentication codes</li>
                <li>Send password reset OTPs</li>
                <li>Send lead notifications</li>
                <li>Send follow-up reminders</li>
              </ul>
            </div>
            <p><strong>SMTP Details:</strong></p>
            <ul>
              <li>Host: ${this.configService.get<string>('SMTP_HOST')}</li>
              <li>Port: ${this.configService.get<string>('SMTP_PORT')}</li>
              <li>From: ${from}</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is a test email from LeadsFlow. You can safely delete this message.</p>
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
      text: `SMTP Configuration Successful!\n\nCongratulations! Your email configuration is working correctly.\n\nYour LeadConnectemail system is ready to send Two-Factor Authentication codes, password reset OTPs, lead notifications, and follow-up reminders.\n\nSMTP Host: ${this.configService.get<string>('SMTP_HOST')}\nSMTP Port: ${this.configService.get<string>('SMTP_PORT')}\nFrom: ${from}`,
    };

    try {
      console.log(`📧 Sending test email to ${toEmail}...`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Test email sent successfully:', info.messageId);
      return {
        success: true,
        message: 'Test email sent successfully! Check your inbox.',
      };
    } catch (error) {
      console.error('❌ Failed to send test email:', error);
      return {
        success: false,
        message: 'Failed to send test email',
        error: error.message || 'Unknown error',
      };
    }
  }
}

