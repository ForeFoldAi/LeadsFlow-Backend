import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThan, Repository } from 'typeorm';
import { AutomationSchedule } from '../entities/automation-schedule.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { CommunicationLog } from '../entities/communication-log.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CommunicationService } from '../communication/communication.service';
import { LeadsService } from '../leads/leads.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class AutomationService {
    private readonly logger = new Logger(AutomationService.name);
    private readonly inFlightScheduleLeadDay = new Set<string>();

    constructor(
        @InjectRepository(AutomationSchedule)
        private readonly scheduleRepository: Repository<AutomationSchedule>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPermissions)
        private readonly userPermissionsRepository: Repository<UserPermissions>,
        @InjectRepository(CommunicationLog)
        private readonly communicationLogRepository: Repository<CommunicationLog>,
        private readonly communicationService: CommunicationService,
        private readonly leadsService: LeadsService,
        private readonly templatesService: TemplatesService,
    ) { }

    async create(createScheduleDto: CreateScheduleDto, userId: string): Promise<AutomationSchedule> {
        // Fetch user and permissions for tagging
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId: userId } });

        const adminId = permissions ? permissions.parentUserId : userId;
        const companyName = user ? user.companyName : undefined;

        // Prevent accidental duplicate schedules from rapid UI clicks.
        const existing = await this.scheduleRepository.findOne({
            where: {
                userId,
                channel: createScheduleDto.channel,
                frequency: createScheduleDto.frequency,
                time: createScheduleDto.time,
                days: createScheduleDto.days ?? null as any,
                targetFilter: createScheduleDto.targetFilter ?? 'due_followup',
                isActive: true,
            },
        });
        if (existing) {
            throw new BadRequestException('A similar active schedule already exists for this time.');
        }

        const schedule = this.scheduleRepository.create({
            ...createScheduleDto,
            userId,
            adminId,
            companyName,
        });
        return await this.scheduleRepository.save(schedule);
    }

    async findAll(userId: string): Promise<AutomationSchedule[]> {
        // Find schedules where user is owner or they belong to the same company
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (user && user.companyName) {
            return await this.scheduleRepository.find({
                where: [
                    { userId },
                    { companyName: user.companyName }
                ],
                order: { createdAt: 'DESC' },
            });
        }

        return await this.scheduleRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string, userId: string): Promise<AutomationSchedule> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        let schedule: AutomationSchedule | null = null;
        if (user?.companyName) {
            schedule = await this.scheduleRepository.findOne({
                where: [
                    { id, userId },
                    { id, companyName: user.companyName },
                ],
            });
        } else {
            schedule = await this.scheduleRepository.findOne({ where: { id, userId } });
        }

        if (!schedule) {
            throw new NotFoundException(`Schedule with ID ${id} not found`);
        }
        return schedule;
    }

    async update(id: string, updateScheduleDto: UpdateScheduleDto, userId: string): Promise<AutomationSchedule> {
        const schedule = await this.findOne(id, userId);

        // If the time (or other schedule-defining fields) is changing, check that no OTHER
        // active schedule already occupies the same slot. This prevents two schedules from
        // silently running at the same time and sending duplicate emails.
        const incomingTime = updateScheduleDto.time ?? schedule.time;
        const incomingChannel = updateScheduleDto.channel ?? schedule.channel;
        const incomingFrequency = updateScheduleDto.frequency ?? schedule.frequency;
        const incomingDays = 'days' in updateScheduleDto ? (updateScheduleDto.days ?? null) : (schedule.days ?? null);
        const incomingTargetFilter = updateScheduleDto.targetFilter ?? schedule.targetFilter ?? 'due_followup';

        const conflict = await this.scheduleRepository.findOne({
            where: {
                userId,
                channel: incomingChannel,
                frequency: incomingFrequency,
                time: incomingTime,
                days: incomingDays as any,
                targetFilter: incomingTargetFilter,
                isActive: true,
            },
        });
        if (conflict && conflict.id !== id) {
            throw new BadRequestException('Another active schedule already exists for this time slot.');
        }

        // When the scheduled time changes, reset lastRunAt so the new time is treated as
        // a fresh schedule. Without this, if lastRunAt happens to fall within the 2-minute
        // claim window relative to the new time, the first cron tick could be incorrectly
        // skipped or double-claimed.
        if (updateScheduleDto.time && updateScheduleDto.time !== schedule.time) {
            schedule.lastRunAt = undefined;
        }

        Object.assign(schedule, updateScheduleDto);
        return await this.scheduleRepository.save(schedule);
    }

    async remove(id: string, userId: string): Promise<void> {
        const schedule = await this.findOne(id, userId);
        await this.scheduleRepository.remove(schedule);
    }

    async runSchedule(id: string, userId: string): Promise<{ processed: number; failed: number }> {
        // Restrict Run Now to schedule owner only to avoid same-company users
        // re-running each other's schedules and causing duplicate sends.
        const schedule = await this.scheduleRepository.findOne({ where: { id, userId } });
        if (!schedule) {
            throw new NotFoundException(`Schedule with ID ${id} not found`);
        }
        this.logger.log(`[RUN_NOW_START] scheduleId=${schedule.id} name="${schedule.name}" userId=${userId}`);

        // Atomically claim the run — prevents duplicate sends if the cron fires at the
        // same moment or if the user clicks "Run Now" twice in quick succession.
        const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
        const claim = await this.scheduleRepository.query(
            `UPDATE automation_schedules SET last_run_at = NOW()
             WHERE id = $1 AND (last_run_at IS NULL OR last_run_at < $2)`,
            [id, threshold],
        );

        if (!claim[1] || claim[1] === 0) {
            this.logger.warn(`[RUN_NOW_SKIPPED] scheduleId=${schedule.id} reason=already-ran-recently`);
            return { processed: 0, failed: 0 };
        }

        const result = await this.processSchedule(schedule, true);
        this.logger.log(
            `[RUN_NOW_DONE] scheduleId=${schedule.id} processed=${result.processed} failed=${result.failed}`,
        );
        return result;
    }

    async processSchedule(schedule: AutomationSchedule, isManualRun = false): Promise<{ processed: number; failed: number }> {
        let processed = 0;
        let failed = 0;
        let skippedNoEmail = 0;
        let skippedNoPhone = 0;
        let skippedAlreadySentForScheduleToday = 0;
        let skippedNoTemplate = 0;
        let skippedSectorMismatch = 0;
        let skippedRecentDuplicate = 0;

        const owner = await this.userRepository.findOne({ where: { id: schedule.userId } });
        const ownerLabelBase = owner?.fullName?.trim() || owner?.email || 'Automation';
        const ownerLabel = `${ownerLabelBase} (auto)`;

        // Pre-load selected templates (if any) so we know which sectors they cover.
        // This prevents sending the "defence" template to non-defence leads.
        type CommunicationTemplate = import('../entities/communication-template.entity').CommunicationTemplate;
        let pinnedTemplates: CommunicationTemplate[] = [];
        const multiIds = schedule.templateIds?.filter(Boolean) ?? [];
        if (multiIds.length > 0) {
            pinnedTemplates = await Promise.all(
                multiIds.map((id) => this.templatesService.findOne(id, schedule.userId))
            );
        } else if (schedule.templateId) {
            const t = await this.templatesService.findOne(schedule.templateId, schedule.userId);
            pinnedTemplates = [t];
        }

        // Sectors covered by the pinned templates (multi-sector templates have t.sectors; else use t.sector).
        // Empty means "no restriction" — auto-pick by lead sector.
        const pinnedSectorSets = pinnedTemplates.map((t) => {
            const list = t.sectors?.length ? t.sectors : (t.sector ? [t.sector] : []);
            return list.map((s) => (s ?? '').toLowerCase());
        });

        // IST date key used for "once per schedule per day" idempotency.
        const istDateParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const getDatePart = (type: string) => istDateParts.find((p) => p.type === type)?.value ?? '';
        const runDateKey = `${getDatePart('year')}-${getDatePart('month')}-${getDatePart('day')}`; // YYYY-MM-DD

        // Get all eligible leads
        const leads = await this.leadsService.findLeadsDueForFollowUp(schedule.userId);
        this.logger.log(
            `[AUTOMATION_PROCESS_START] scheduleId=${schedule.id} name="${schedule.name}" userId=${schedule.userId} ` +
            `channel=${schedule.channel} eligibleLeads=${leads.length}`,
        );

        for (const lead of leads) {
            // Check contact info for the chosen channel
            if (schedule.channel === 'email' && !lead.email) {
                skippedNoEmail++;
                this.logger.warn(`[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} reason=no-email`);
                continue;
            }
            if ((schedule.channel === 'sms' || schedule.channel === 'whatsapp') && !lead.phoneNumber) {
                skippedNoPhone++;
                this.logger.warn(`[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} reason=no-phone`);
                continue;
            }

            try {
                // Per-schedule per-day rule (email):
                // same schedule should not send to same lead more than once in the same IST day,
                // but it should send again on the next scheduled day.
                if (schedule.channel === 'email') {
                    const scheduleMarker = `<!-- automation-schedule:${schedule.id}:date:${runDateKey} -->`;
                    // Skip the daily-limit check for manual Run Now — it is independent of the scheduler.
                    if (!isManualRun) {
                        const alreadySentForSchedule = await this.communicationLogRepository.findOne({
                            where: {
                                leadId: lead.id,
                                userId: schedule.userId,
                                type: 'email',
                                status: 'sent',
                                content: Like(`%${scheduleMarker}%`),
                                sentAt: MoreThan(schedule.updatedAt),
                            },
                            order: { sentAt: 'DESC' },
                        });

                        if (alreadySentForSchedule) {
                            skippedAlreadySentForScheduleToday++;
                            this.logger.warn(
                                `[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} userId=${schedule.userId} ` +
                                `reason=schedule-already-sent-today runDate=${runDateKey} sentAt=${alreadySentForSchedule.sentAt.toISOString()}`,
                            );
                            continue;
                        }
                    }
                }

                let content = '';
                let subject = '';

                if (schedule.channel === 'email') {
                    let template: CommunicationTemplate | null = null;

                    if (pinnedTemplates.length > 0) {
                        // Only send to leads whose sector matches one of the pinned templates (sector or sectors array)
                        const leadSector = (lead.sector ?? '').toLowerCase();
                        const match = pinnedTemplates.find((_t, i) =>
                            pinnedSectorSets[i].includes(leadSector),
                        );
                        if (!match) {
                            // Lead's sector not covered by this schedule — skip silently
                            skippedSectorMismatch++;
                            this.logger.debug(
                                `[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} reason=sector-mismatch leadSector="${leadSector}"`,
                            );
                            continue;
                        }
                        // If multiple templates match the lead's sector, pick one randomly
                        const sectorMatches = pinnedTemplates.filter((_t, i) =>
                            pinnedSectorSets[i].includes(leadSector),
                        );
                        template = sectorMatches[Math.floor(Math.random() * sectorMatches.length)];
                    } else if (lead.sector) {
                        // No templates pinned — auto-pick by lead's sector
                        const templates = await this.templatesService.findBySector('email', lead.sector, schedule.userId);
                        template = templates[0] ?? null;
                    }

                    if (template) {
                        subject = this.personalize(template.subject || '', lead);
                        content = this.personalize(template.body, lead);
                        // Persist schedule identity inside log content (HTML comment)
                        // so we can enforce "one send per schedule per lead" without schema changes.
                        content = `${content}\n<!-- automation-schedule:${schedule.id}:date:${runDateKey} -->`;
                    } else {
                        skippedNoTemplate++;
                        this.logger.warn(
                            `[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} ` +
                            `reason=no-template leadSector="${lead.sector ?? ''}"`,
                        );
                        continue;
                    }
                } else if (schedule.channel === 'sms') {
                    content = this.personalize(schedule.smsMessage || '', lead);
                } else if (schedule.channel === 'whatsapp') {
                    content = this.personalize(schedule.whatsappMessage || '', lead);
                }

                if (content) {
                    const inFlightKey = `${schedule.id}:${lead.id}:${schedule.channel}:${runDateKey}`;
                    if (this.inFlightScheduleLeadDay.has(inFlightKey)) {
                        skippedRecentDuplicate++;
                        this.logger.warn(
                            `[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} reason=in-flight-duplicate`,
                        );
                        continue;
                    }
                    this.inFlightScheduleLeadDay.add(inFlightKey);

                    // Idempotency guard:
                    // Skip if an identical message for this lead/channel was already sent
                    // in the recent window. This prevents duplicate deliveries when the same
                    // schedule is triggered multiple times or overlapping schedules exist.
                    // Use the later of (now - 10min) or schedule.updatedAt so that editing
                    // the schedule time resets the dedupe window.
                    const dedupeWindowMs = 10 * 60 * 1000; // 10 minutes
                    const tenMinAgo = new Date(Date.now() - dedupeWindowMs);
                    const sentAfter = schedule.updatedAt > tenMinAgo ? schedule.updatedAt : tenMinAgo;
                    const dedupeWhere: any = {
                        leadId: lead.id,
                        type: schedule.channel,
                        status: 'sent',
                        content,
                        sentAt: MoreThan(sentAfter),
                    };
                    if (schedule.channel === 'email') {
                        dedupeWhere.subject = subject;
                    }
                    const existing = await this.communicationLogRepository.findOne({
                        where: dedupeWhere,
                        order: { sentAt: 'DESC' },
                    });
                    if (existing) {
                        skippedRecentDuplicate++;
                        this.logger.warn(
                            `[AUTOMATION_SKIP] scheduleId=${schedule.id} leadId=${lead.id} ` +
                            `reason=recent-duplicate channel=${schedule.channel} sentAt=${existing.sentAt.toISOString()}`,
                        );
                        continue;
                    }

                    await this.communicationService.sendMessage({
                        leadId: lead.id,
                        type: schedule.channel,
                        subject,
                        content,
                        templateId: schedule.templateId,
                        scheduleUpdatedAt: schedule.updatedAt,
                    }, schedule.userId);
                    processed++;
                    this.logger.log(
                        `[AUTOMATION_SENT] scheduleId=${schedule.id} leadId=${lead.id} channel=${schedule.channel}`,
                    );

                    await this.leadsService.setLastContactedByFromAutomation(lead.id, ownerLabel);
                    await this.sleep(2000);
                    this.inFlightScheduleLeadDay.delete(inFlightKey);
                }
            } catch (error) {
                const inFlightKey = `${schedule.id}:${lead.id}:${schedule.channel}:${runDateKey}`;
                this.inFlightScheduleLeadDay.delete(inFlightKey);
                this.logger.error(
                    `[AUTOMATION_ERROR] scheduleId=${schedule.id} leadId=${lead.id} channel=${schedule.channel} error=${error.message}`,
                );
                failed++;
            }
        }

        this.logger.log(
            `[AUTOMATION_PROCESS_DONE] scheduleId=${schedule.id} name="${schedule.name}" ` +
            `processed=${processed} failed=${failed} ` +
            `skippedNoEmail=${skippedNoEmail} skippedNoPhone=${skippedNoPhone} ` +
            `skippedAlreadySentForScheduleToday=${skippedAlreadySentForScheduleToday} skippedNoTemplate=${skippedNoTemplate} ` +
            `skippedSectorMismatch=${skippedSectorMismatch} skippedRecentDuplicate=${skippedRecentDuplicate}`,
        );

        return { processed, failed };
    }

    private personalize(text: string, lead: any, sender?: any): string {
        return text
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{company\}\}/g, lead.companyName || '')
            .replace(/\{\{email\}\}/g, lead.email || '')
            .replace(/\{\{phone\}\}/g, lead.phoneNumber || '')
            .replace(/\{\{city\}\}/g, lead.city || '')
            .replace(/\{\{sender_name\}\}/g, sender?.fullName || '')
            .replace(/\{\{sender_company\}\}/g, sender?.companyName || '')
            .replace(/\{\{sender_email\}\}/g, sender?.email || '')
            .replace(/\{\{sender_phone\}\}/g, sender?.phoneNumber || '')
            .replace(/\{\{sender_website\}\}/g, sender?.website || '')
            .replace(/\{\{sender_industry\}\}/g, sender?.industry || sender?.customIndustry || '');
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
