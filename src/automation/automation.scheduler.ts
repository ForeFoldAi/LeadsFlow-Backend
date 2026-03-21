import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

    @Cron('* * * * *', { timeZone: 'Asia/Kolkata' }) // Run every minute so any HH:MM schedule can fire on time
    async handleCron() {
        const now = new Date();

        // Always evaluate time in Asia/Kolkata so schedule times match what the user configured
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
            hour12: false,
        }).formatToParts(now);

        const getVal = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
        const currentHourMinute = `${getVal('hour').padStart(2, '0')}:${getVal('minute').padStart(2, '0')}`;
        const currentWeekday = getVal('weekday').toLowerCase().slice(0, 3); // 'sun', 'mon', …

        this.logger.debug(`Scheduler tick at ${currentHourMinute} IST (${currentWeekday})`);

        const activeSchedules = await this.scheduleRepository.find({
            where: { isActive: true },
        });

        for (const schedule of activeSchedules) {
            if (this.isScheduledToRun(schedule, currentHourMinute, currentWeekday)) {
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

    private isScheduledToRun(schedule: AutomationSchedule, currentHourMinute: string, currentWeekday: string): boolean {
        // Exact minute match in IST
        if (schedule.time !== currentHourMinute) {
            return false;
        }

        // Guard against double-firing (e.g. two backend instances or a restart overlap).
        // If the schedule already ran within the last 2 minutes, skip it.
        if (schedule.lastRunAt) {
            const msSinceLastRun = Date.now() - new Date(schedule.lastRunAt).getTime();
            if (msSinceLastRun < 2 * 60 * 1000) {
                this.logger.warn(`Skipping schedule "${schedule.name}" — already ran ${Math.round(msSinceLastRun / 1000)}s ago`);
                return false;
            }
        }

        if (schedule.frequency === 'daily') {
            return true;
        } else if (schedule.frequency === 'weekly') {
            // weekly fires every Monday by default
            return currentWeekday === 'mon';
        } else if (schedule.frequency === 'custom' && schedule.days) {
            // Normalise user input: "Sat, Sun" / "sat,sun" / "SAT" all work
            const userDays = schedule.days
                .split(',')
                .map((d) => d.trim().toLowerCase().slice(0, 3));
            return userDays.includes(currentWeekday);
        }

        return false;
    }
}
