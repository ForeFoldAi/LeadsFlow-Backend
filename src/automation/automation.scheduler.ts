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

    @Cron('* * * * *') // Run every minute so any HH:MM schedule can fire on time
    async handleCron() {
        const now = new Date();
        const currentHourMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        this.logger.debug(`Scheduler tick at ${currentHourMinute}`);

        const activeSchedules = await this.scheduleRepository.find({
            where: { isActive: true },
        });

        for (const schedule of activeSchedules) {
            if (this.isScheduledToRun(schedule, now, currentHourMinute)) {
                this.logger.log(`Executing scheduled automation: ${schedule.name}`);
                try {
                    await this.automationService.processSchedule(schedule);
                    await this.scheduleRepository.update(schedule.id, { lastRunAt: new Date() });
                } catch (err) {
                    this.logger.error(`Failed to run schedule ${schedule.id}: ${err.message}`);
                }
            }
        }
    }

    private isScheduledToRun(schedule: AutomationSchedule, now: Date, currentHourMinute: string): boolean {
        // Exact minute match (cron now runs every minute so this is precise)
        if (schedule.time !== currentHourMinute) {
            return false;
        }

        // Day abbreviations — accept any casing from the user
        const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const currentDayAbbr = DAY_ABBR[now.getDay()]; // e.g. "sat"

        if (schedule.frequency === 'daily') {
            return true;
        } else if (schedule.frequency === 'weekly') {
            // weekly fires every Monday by default
            return now.getDay() === 1;
        } else if (schedule.frequency === 'custom' && schedule.days) {
            // Normalise user input: "Sat, Sun" / "sat,sun" / "SAT" all work
            const userDays = schedule.days
                .split(',')
                .map((d) => d.trim().toLowerCase().slice(0, 3));
            return userDays.includes(currentDayAbbr);
        }

        return false;
    }
}
