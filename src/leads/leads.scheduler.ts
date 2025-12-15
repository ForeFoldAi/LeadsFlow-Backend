import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadsService } from './leads.service';

@Injectable()
export class LeadsScheduler {
  private readonly logger = new Logger(LeadsScheduler.name);

  constructor(private readonly leadsService: LeadsService) {}

  /**
   * Send follow-up reminders daily at 12:00 PM (noon)
   * Cron expression: '0 12 * * *'
   * - 0: minute (0)
   * - 12: hour (12 PM / noon)
   * - *: day of month (every day)
   * - *: month (every month)
   * - *: day of week (every day of week)
   */
  @Cron('0 12 * * *', {
    name: 'follow-up-reminders-noon',
    timeZone: 'Asia/Kolkata', // Change this to your timezone (e.g., 'America/New_York', 'Europe/London', etc.)
  })
  async handleFollowUpRemindersNoon() {
    this.logger.log('🔔 Starting scheduled follow-up reminders job at 12:00 PM');
    
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

