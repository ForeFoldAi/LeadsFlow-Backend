import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private actionCenterTransporter?: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpSecure = this.configService.get<string>('SMTP_SECURE');
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const timeoutMsRaw = this.configService.get<string>('SMTP_TIMEOUT_MS');
    const timeoutMs = timeoutMsRaw ? parseInt(timeoutMsRaw, 10) : 30000;

    // Log SMTP configuration (without password) for debugging
    console.log('📧 SMTP Configuration:');
    console.log(`   Host: ${smtpHost || 'NOT SET'}`);
    console.log(`   Port: ${smtpPort || 'NOT SET'}`);
    console.log(`   Secure: ${smtpSecure || 'NOT SET'}`);
    console.log(`   User: ${smtpUser || 'NOT SET'}`);
    console.log(`   Password: ${this.configService.get<string>('SMTP_PASS') ? '****' + this.configService.get<string>('SMTP_PASS')?.slice(-4) : 'NOT SET'}`);
    console.log(`   Timeout: ${Number.isFinite(timeoutMs) ? `${timeoutMs}ms` : 'NOT SET'}`);

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort ? parseInt(smtpPort, 10) : 465,
      secure: smtpSecure === 'true' || smtpSecure === '1', // true for 465, false for other ports
      requireTLS: smtpPort === '587', // Force TLS for port 587
      auth: {
        user: smtpUser,
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      // Add connection timeout and logging
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      debug: true, // Enable detailed logs
      logger: true, // Enable detailed logs
      tls: {
        servername: smtpHost,
        rejectUnauthorized: false // Bypass certificate issues
      }
    });

    // Optional: separate SMTP config for Lead Action Center emails
    const acHost = this.configService.get<string>('ACTION_CENTER_SMTP_HOST');
    const acUser = this.configService.get<string>('ACTION_CENTER_SMTP_USER');
    const acPass = this.configService.get<string>('ACTION_CENTER_SMTP_PASS');
    if (acHost && acUser && acPass) {
      const acPort = this.configService.get<string>('ACTION_CENTER_SMTP_PORT') || smtpPort;
      const acSecure = this.configService.get<string>('ACTION_CENTER_SMTP_SECURE') || smtpSecure;
      const acTimeoutMsRaw = this.configService.get<string>('ACTION_CENTER_SMTP_TIMEOUT_MS') || timeoutMsRaw;
      const acTimeoutMs = acTimeoutMsRaw ? parseInt(acTimeoutMsRaw, 10) : timeoutMs;

      console.log('📧 Action Center SMTP Configuration:');
      console.log(`   Host: ${acHost}`);
      console.log(`   Port: ${acPort || 'NOT SET'}`);
      console.log(`   Secure: ${acSecure || 'NOT SET'}`);
      console.log(`   User: ${acUser}`);
      console.log(`   Password: ${acPass ? '****' + acPass.slice(-4) : 'NOT SET'}`);
      console.log(`   Timeout: ${Number.isFinite(acTimeoutMs) ? `${acTimeoutMs}ms` : 'NOT SET'}`);

      this.actionCenterTransporter = nodemailer.createTransport({
        host: acHost,
        port: acPort ? parseInt(acPort, 10) : 465,
        secure: acSecure === 'true' || acSecure === '1',
        requireTLS: acPort === '587',
        auth: {
          user: acUser,
          pass: acPass,
        },
        connectionTimeout: acTimeoutMs,
        greetingTimeout: acTimeoutMs,
        socketTimeout: acTimeoutMs,
        debug: true,
        logger: true,
        tls: {
          servername: acHost,
          rejectUnauthorized: false,
        },
      });
    }
  }

  /**
   * Get ForeFold branded email footer HTML
   * Includes logo, contact information, and company details
   */
  public getEmailFooter(): string {
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

  /**
   * Wraps plain text content in a professional HTML template
   */
  public wrapInBrandedTemplate(title: string, content: string): string {
    const formattedContent = content.replace(/\n/g, '<br />');
    const logoBase64 = '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';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td style="padding:32px 24px 0 24px;">

        <!-- Content -->
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.75;color:#344054;">
          ${formattedContent}
        </p>

        <!-- Divider -->
        <div style="height:1px;background-color:#EAECF0;margin:32px 0;"></div>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding-bottom:12px;">
              <img src="data:image/png;base64,${logoBase64}" alt="ForeFold Logo" width="72" height="72" style="display:block;border:0;border-radius:12px;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#101828;">ForeFold Consulting Services</p>
              <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:#667085;text-align:center;">
                RV Fortune Nest, 2, Alkapoor Township, Manikonda,<br/>Hyderabad, Telangana 500089, India
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-right:16px;">
                    <a href="https://forefoldai.com" style="font-size:12px;color:#7F56D9;text-decoration:none;font-weight:500;">forefoldai.com</a>
                  </td>
                  <td>
                    <a href="mailto:contact@forefoldai.com" style="font-size:12px;color:#667085;text-decoration:none;">contact@forefoldai.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 0 32px 0;">
              <p style="margin:0;font-size:12px;color:#98A2B3;">© 2024 ForeFold Consulting Services LLP. All rights reserved.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /** Transient SMTP errors that may succeed on retry (ECONNRESET, ETIMEDOUT, etc.) */
  private static readonly RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'EPIPE', 'ENOTFOUND']);

  private async sendMailWithTransporter(
    transporter: nodemailer.Transporter,
    from: string | undefined,
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    const maxRetries = 3;
    const retryDelayMs = 2000;

    const mailOptions = {
      from: from,
      to: to,
      subject: subject,
      html: html,
      text: text || '',
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        return;
      } catch (error) {
        lastError = error as Error;
        const err = error as any;
        const code = err?.code ? String(err.code) : '';
        const isRetryable =
          EmailService.RETRYABLE_CODES.has(code) ||
          (err?.message && /timeout|reset|refused/i.test(String(err.message)));
        if (isRetryable && attempt < maxRetries) {
          console.warn(`SMTP attempt ${attempt}/${maxRetries} failed (${code}), retrying in ${retryDelayMs}ms...`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
        } else {
          break;
        }
      }
    }

    console.error('Error sending generic email:', lastError);
    const err = lastError as any;
    const code = err?.code ? String(err.code) : undefined;
    const message = err?.message ? String(err.message) : 'Unknown email error';
    const details = [code && `code=${code}`, `message=${message}`].filter(Boolean).join(' ');
    throw new Error(details || 'Failed to send email');
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    await this.sendMailWithTransporter(this.transporter, from, to, subject, html, text);
  }

  async sendActionCenterMail(to: string, subject: string, html: string, text?: string): Promise<void> {
    const transporter = this.actionCenterTransporter || this.transporter;
    const from =
      this.configService.get<string>('ACTION_CENTER_SMTP_FROM') ||
      this.configService.get<string>('ACTION_CENTER_SMTP_USER') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER');
    await this.sendMailWithTransporter(transporter, from, to, subject, html, text);
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

