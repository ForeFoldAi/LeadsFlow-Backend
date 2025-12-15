import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadsService } from './leads.service';

@Injectable()
export class LeadsScheduler {
  private readonly logger = new Logger(LeadsScheduler.name);

  constructor(private readonly leadsService: LeadsService) {}

  /**
   * Send follow-up reminders daily at 2:05 PM
   * Cron expression: '5 14 * * *'
   * - 5: minute (5)
   * - 14: hour (2 PM / 14:00)
   * - *: day of month (every day)
   * - *: month (every month)
   * - *: day of week (every day of week)
   */
  @Cron('5 14 * * *', {
    name: 'follow-up-reminders-noon',
    timeZone: 'Asia/Kolkata', // Change this to your timezone (e.g., 'America/New_York', 'Europe/London', etc.)
  })
  async handleFollowUpRemindersNoon() {
    this.logger.log('🔔 Starting scheduled follow-up reminders job at 2:05 PM');
    
    try {
      const result = await this.leadsService.sendFollowUpReminders();
      
      this.logger.log(
        `✅ Follow-up reminders job completed successfully: ` +
        `${result.sent} sent, ${result.errors} errors, ${result.skipped} skipped`
      );
    } catch (error) {
      this.logger.error('❌ Error running follow-up reminders job:', error);
    }
  }

  /**
   * Send follow-up reminders daily at 8:30 PM
   * Cron expression: '30 20 * * *'
   * - 30: minute (30)
   * - 20: hour (8 PM / 20:00)
   * - *: day of month (every day)
   * - *: month (every month)
   * - *: day of week (every day of week)
   */
  @Cron('30 20 * * *', {
    name: 'follow-up-reminders',
    timeZone: 'Asia/Kolkata', // Change this to your timezone (e.g., 'America/New_York', 'Europe/London', etc.)
  })
  async handleFollowUpReminders() {
    this.logger.log('🔔 Starting scheduled follow-up reminders job at 8:30 PM');
    
    try {
      const result = await this.leadsService.sendFollowUpReminders();
      
      this.logger.log(
        `✅ Follow-up reminders job completed successfully: ` +
        `${result.sent} sent, ${result.errors} errors, ${result.skipped} skipped`
      );
    } catch (error) {
      this.logger.error('❌ Error running follow-up reminders job:', error);
    }
  }

  /**
   * Test method - runs every minute (for testing purposes)
   * Comment this out in production or remove it
   * Uncomment the @Cron decorator below to enable
   */
  // @Cron(CronExpression.EVERY_MINUTE, {
  //   name: 'follow-up-reminders-test',
  // })
  // async handleFollowUpRemindersTest() {
  //   this.logger.log('🧪 TEST: Running follow-up reminders job (every minute)');
  //   
  //   try {
  //     const result = await this.leadsService.sendFollowUpReminders();
  //     
  //     this.logger.log(
  //       `✅ TEST: Follow-up reminders completed: ` +
  //       `${result.sent} sent, ${result.errors} errors, ${result.skipped} skipped`
  //     );
  //   } catch (error) {
  //     this.logger.error('❌ TEST: Error running follow-up reminders:', error);
  //   }
  // }
}

