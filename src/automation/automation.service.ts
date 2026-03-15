import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationSchedule } from '../entities/automation-schedule.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CommunicationService } from '../communication/communication.service';
import { LeadsService } from '../leads/leads.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class AutomationService {
    private readonly logger = new Logger(AutomationService.name);

    constructor(
        @InjectRepository(AutomationSchedule)
        private readonly scheduleRepository: Repository<AutomationSchedule>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPermissions)
        private readonly userPermissionsRepository: Repository<UserPermissions>,
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
        Object.assign(schedule, updateScheduleDto);
        return await this.scheduleRepository.save(schedule);
    }

    async remove(id: string, userId: string): Promise<void> {
        const schedule = await this.findOne(id, userId);
        await this.scheduleRepository.remove(schedule);
    }

    async runSchedule(id: string, userId: string): Promise<{ processed: number; failed: number }> {
        const schedule = await this.findOne(id, userId);
        this.logger.log(`Manually running schedule: ${schedule.name}`);

        const result = await this.processSchedule(schedule);

        await this.scheduleRepository.update(id, {
            lastRunAt: new Date(),
        });

        return result;
    }

    async processSchedule(schedule: AutomationSchedule): Promise<{ processed: number; failed: number }> {
        let processed = 0;
        let failed = 0;

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

        // Get all eligible leads
        const leads = await this.leadsService.findLeadsDueForFollowUp(schedule.userId);

        for (const lead of leads) {
            // Check contact info for the chosen channel
            if (schedule.channel === 'email' && !lead.email) {
                this.logger.warn(`Skipping lead ${lead.id} - no email`);
                continue;
            }
            if ((schedule.channel === 'sms' || schedule.channel === 'whatsapp') && !lead.phoneNumber) {
                this.logger.warn(`Skipping lead ${lead.id} - no phone`);
                continue;
            }

            try {
                let content = '';
                let subject = '';

                if (schedule.channel === 'email') {
                    let template: CommunicationTemplate | null = null;

                    if (pinnedTemplates.length > 0) {
                        // Only send to leads whose sector matches one of the pinned templates (sector or sectors array)
                        const leadSector = (lead.sector ?? '').toLowerCase();
                        const match = pinnedTemplates.find((t, i) =>
                            pinnedSectorSets[i].includes(leadSector),
                        );
                        if (!match) {
                            // Lead's sector not covered by this schedule — skip silently
                            continue;
                        }
                        // If multiple templates match the lead's sector, pick one randomly
                        const sectorMatches = pinnedTemplates.filter((t, i) =>
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
                    } else {
                        this.logger.warn(`No template for lead ${lead.id} sector "${lead.sector}" in schedule ${schedule.id}`);
                        continue;
                    }
                } else if (schedule.channel === 'sms') {
                    content = this.personalize(schedule.smsMessage || '', lead);
                } else if (schedule.channel === 'whatsapp') {
                    content = this.personalize(schedule.whatsappMessage || '', lead);
                }

                if (content) {
                    await this.communicationService.sendMessage({
                        leadId: lead.id,
                        type: schedule.channel,
                        subject,
                        content,
                        templateId: schedule.templateId,
                    }, schedule.userId);
                    processed++;

                    await this.leadsService.setLastContactedByFromAutomation(lead.id, ownerLabel);
                    await this.sleep(2000);
                }
            } catch (error) {
                this.logger.error(`Error processing lead ${lead.id} for schedule ${schedule.id}: ${error.message}`);
                failed++;
            }
        }

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
