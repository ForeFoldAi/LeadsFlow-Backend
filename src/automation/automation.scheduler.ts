import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationSchedule } from '../entities/automation-schedule.entity';
import { AutomationService } from './automation.service';

@Injectable()
export class AutomationScheduler {
    private readonly logger = new Logger(AutomationScheduler.name);

    constructor(
        @InjectRepository(AutomationSchedule)
        private readonly scheduleRepository: Repository<AutomationSchedule>,
        private readonly automationService: AutomationService,
    ) { }

    @Cron(CronExpression.EVERY_HOUR) // Run every hour to check for matching schedules
    async handleCron() {
        this.logger.debug('Running automation scheduler check...');

        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMinute = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMinute}`;

        // Find active schedules that match the current time
        // Note: This is an simplified implementation. 
        // In a real scenario, we might want to handle day-of-week checks for 'weekly' and 'custom'.
        const activeSchedules = await this.scheduleRepository.find({
            where: {
                isActive: true,
                // time: currentTime // We might want a range or a more robust matching logic
            }
        });

        for (const schedule of activeSchedules) {
            if (this.isScheduledToRun(schedule, now)) {
                this.logger.log(`Executing scheduled automation: ${schedule.name}`);
                await this.automationService.processSchedule(schedule);

                await this.scheduleRepository.update(schedule.id, {
                    lastRunAt: new Date(),
                });
            }
        }
    }

    private isScheduledToRun(schedule: AutomationSchedule, now: Date): boolean {
        const currentHourMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (schedule.time !== currentHourMinute) {
            return false;
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayNames[now.getDay()];

        if (schedule.frequency === 'daily') {
            return true;
        } else if (schedule.frequency === 'weekly') {
            // For simplicity, let's assume weekly runs on Monday or a specific day
            // In a full implementation, we'd have a 'runDay' field
            return now.getDay() === 1; // Monday
        } else if (schedule.frequency === 'custom' && schedule.days) {
            return schedule.days.includes(currentDay);
        }

        return false;
    }
}
