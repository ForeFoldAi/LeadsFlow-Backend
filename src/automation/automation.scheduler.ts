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

        this.logger.debug(`[AUTOMATION_TICK] time=${currentHourMinute} weekday=${currentWeekday} tz=Asia/Kolkata`);

        const activeSchedules = await this.scheduleRepository.find({
            where: { isActive: true },
        });
        this.logger.log(`[AUTOMATION_SCAN] activeSchedules=${activeSchedules.length} at=${currentHourMinute}(${currentWeekday})`);

        const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

        for (const schedule of activeSchedules) {
            if (!this.isScheduledToRun(schedule, currentHourMinute, currentWeekday)) {
                continue;
            }
            this.logger.log(
                `[SCHEDULE_MATCH] id=${schedule.id} name="${schedule.name}" userId=${schedule.userId} ` +
                `channel=${schedule.channel} frequency=${schedule.frequency} time=${schedule.time}`,
            );

            // Atomically claim the schedule by updating lastRunAt only if it hasn't
            // been claimed yet. This prevents two backend instances from both running
            // the same schedule simultaneously (race condition).
            const claim = await this.scheduleRepository
                .createQueryBuilder()
                .update(AutomationSchedule)
                .set({ lastRunAt: new Date() })
                .where('id = :id', { id: schedule.id })
                .andWhere('(last_run_at IS NULL OR last_run_at < :threshold)', { threshold })
                .execute();

            if (!claim.affected || claim.affected === 0) {
                this.logger.warn(`[SCHEDULE_CLAIM_SKIPPED] id=${schedule.id} name="${schedule.name}" reason=already-claimed-recently`);
                continue;
            }

            this.logger.log(`[SCHEDULE_EXECUTE_START] id=${schedule.id} name="${schedule.name}"`);
            try {
                const result = await this.automationService.processSchedule(schedule);
                this.logger.log(
                    `[SCHEDULE_EXECUTE_DONE] id=${schedule.id} name="${schedule.name}" ` +
                    `processed=${result.processed} failed=${result.failed}`,
                );
            } catch (err) {
                this.logger.error(`[SCHEDULE_EXECUTE_ERROR] id=${schedule.id} name="${schedule.name}" error=${err.message}`);
            }
        }
    }

    private isScheduledToRun(schedule: AutomationSchedule, currentHourMinute: string, currentWeekday: string): boolean {
        // Exact minute match in IST
        if (schedule.time !== currentHourMinute) {
            return false;
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
