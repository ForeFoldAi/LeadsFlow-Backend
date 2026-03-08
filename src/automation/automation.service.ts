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
        const schedule = await this.scheduleRepository.findOne({
            where: { id, userId },
        });
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

        // 1. Get leads based on targetFilter
        const leads = await this.leadsService.findLeadsDueForFollowUp(schedule.userId);

        for (const lead of leads) {
            // Check if contact info exists for the chosen channel
            if (schedule.channel === 'email' && !lead.email) {
                this.logger.warn(`Skipping lead ${lead.id} for schedule ${schedule.id} - no email address`);
                continue;
            }
            if ((schedule.channel === 'sms' || schedule.channel === 'whatsapp') && !lead.phoneNumber) {
                this.logger.warn(`Skipping lead ${lead.id} for schedule ${schedule.id} - no phone number`);
                continue;
            }

            try {
                let content = '';
                let subject = '';

                if (schedule.channel === 'email') {
                    let template;
                    if (schedule.templateId) {
                        template = await this.templatesService.findOne(schedule.templateId, schedule.userId);
                    } else if (lead.sector) {
                        const templates = await this.templatesService.findBySector('email', lead.sector, schedule.userId);
                        template = templates[0];
                    }

                    if (template) {
                        subject = this.personalize(template.subject || '', lead);
                        content = this.personalize(template.body, lead);
                    } else {
                        this.logger.warn(`No template found for lead ${lead.id} in schedule ${schedule.id}`);
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

                    // Add 2 second delay between successful messages to prevent spam/rate limits
                    await this.sleep(2000);
                }
            } catch (error) {
                this.logger.error(`Error processing lead ${lead.id} for schedule ${schedule.id}: ${error.message}`);
                failed++;
            }
        }

        return { processed, failed };
    }

    private personalize(text: string, lead: any): string {
        return text
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{company\}\}/g, lead.companyName || 'your company');
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
