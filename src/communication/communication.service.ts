import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    HttpException,
    OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationLog } from '../entities/communication-log.entity';
import { Lead } from '../entities/lead.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { EmailService } from '../auth/services/email.service';
import { SendMessageDto } from './dto/send-message.dto';
import Twilio from 'twilio';

@Injectable()
export class CommunicationService implements OnModuleInit {
    private readonly logger = new Logger(CommunicationService.name);
    private readonly twilioClient: ReturnType<typeof Twilio>;
    private readonly twilioPhone: string;

    constructor(
        @InjectRepository(CommunicationLog)
        private readonly logRepository: Repository<CommunicationLog>,
        @InjectRepository(Lead)
        private readonly leadRepository: Repository<Lead>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPermissions)
        private readonly userPermissionsRepository: Repository<UserPermissions>,
        private readonly emailService: EmailService,
    ) {
        this.twilioClient = Twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
        );
        this.twilioPhone = process.env.TWILIO_PHONE_NUMBER!;
    }

    async sendMessage(sendMessageDto: SendMessageDto, userId: string): Promise<CommunicationLog> {
        const { leadId, type, subject, content } = sendMessageDto;

        this.logger.log(`Attempting to send ${type} to lead ${leadId} by user ${userId}`);
        const lead = await this.leadRepository.findOne({ where: { id: leadId } });
        if (!lead) {
            this.logger.error(`Lead ${leadId} not found`);
            throw new NotFoundException('Lead not found');
        }

        // Fetch user and permissions for tagging
        let user = await this.userRepository.findOne({ where: { id: userId } });
        this.logger.log(`Found user: ${user?.email || 'NOT FOUND'}, companyName: ${user?.companyName || 'NULL'}`);
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId: userId } });

        const adminId = permissions ? permissions.parentUserId : userId;

        // If the user has no companyName (sub-user), inherit from parent admin
        if (user && !user.companyName && adminId && adminId !== userId) {
            const adminUser = await this.userRepository.findOne({ where: { id: adminId } });
            if (adminUser?.companyName) {
                user = { ...user, companyName: adminUser.companyName } as User;
                this.logger.log(`Inherited companyName from admin: ${adminUser.companyName}`);
            }
        }

        const companyName = user ? user.companyName : undefined;

        let status: 'sent' | 'failed' = 'sent';
        let errorMessage: string | null = null;
        let failureException: HttpException | null = null;
        try {
            if (type === 'email') {
                if (!lead.email) {
                    throw new BadRequestException('Lead has no email address');
                }
                const emailSubject = subject || 'Message from LeadsFlow';
                const htmlContent = this.formatEmailContent(content, lead, emailSubject, user ?? undefined);
                await this.emailService.sendActionCenterMail(lead.email, emailSubject, htmlContent);
            } else if (type === 'sms' || type === 'whatsapp') {
                if (!lead.phoneNumber) {
                    throw new BadRequestException('Lead has no phone number');
                }
                const normalizedPhone = this.normalizePhone(lead.phoneNumber);
                const to = type === 'whatsapp'
                    ? `whatsapp:${normalizedPhone}`
                    : normalizedPhone;
                const from = type === 'whatsapp'
                    ? `whatsapp:${this.twilioPhone}`
                    : this.twilioPhone;
                const body = this.substituteVariables(content, lead, user ?? undefined);
                await this.twilioClient.messages.create({ to, from, body });
                this.logger.log(`Sent ${type} to ${normalizedPhone}`);
            } else {
                throw new BadRequestException(`Unsupported message type: ${type}`);
            }
        } catch (error) {
            if (error instanceof HttpException) {
                failureException = error;
            }
            const message = error instanceof Error ? error.message : String(error);
            errorMessage = message;
            this.logger.error(`Failed to send ${type} to lead ${leadId}: ${message}`);
            status = 'failed';
        }

        const log = this.logRepository.create({
            leadId,
            userId,
            type,
            subject,
            content,
            status,
            errorMessage,
            adminId,
            companyName,
        });

        const savedLog = await this.logRepository.save(log);

        // Update lead's last contacted date if successful.
        // Do NOT overwrite lastContactedBy – that field is user-controlled via forms.
        if (status === 'sent') {
            await this.leadRepository.update(leadId, {
                lastContactedDate: new Date(),
            });
        }

        // Return log with relations
        const finalLog = await this.logRepository.findOne({
            where: { id: savedLog.id },
            relations: ['lead', 'user'],
        });

        if (!finalLog) {
            throw new InternalServerErrorException('Failed to retrieve saved log');
        }

        // IMPORTANT: if delivery failed, return a non-2xx response so the frontend can count failures correctly
        if (status === 'failed') {
            if (failureException) {
                throw failureException;
            }
            const userMessage = type === 'email'
                ? 'Unable to send email. Please try again or check your SMTP settings.'
                : 'Failed to send message. Please try again.';
            throw new InternalServerErrorException(userMessage);
        }

        return this.sanitizeLog(finalLog);
    }

    private normalizePhone(phone: string): string {
        // Strip all non-digit characters except leading +
        const stripped = phone.replace(/[^\d+]/g, '');
        if (stripped.startsWith('+')) return stripped;
        // Prepend + — phone numbers should be stored with country code (e.g. 916300407229)
        return `+${stripped}`;
    }

    private applyVariables(content: string, lead: Lead, sender?: User): string {
        return content
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{company\}\}/g, lead.companyName || '')
            .replace(/\{\{email\}\}/g, lead.email || '')
            .replace(/\{\{phone\}\}/g, lead.phoneNumber || '')
            .replace(/\{\{city\}\}/g, (lead as any).city || '')
            .replace(/\{\{sender_name\}\}/g, sender?.fullName || '')
            .replace(/\{\{sender_company\}\}/g, sender?.companyName || '')
            .replace(/\{\{sender_email\}\}/g, sender?.email || '')
            .replace(/\{\{sender_phone\}\}/g, sender?.phoneNumber || '')
            .replace(/\{\{sender_website\}\}/g, sender?.website || '')
            .replace(/\{\{sender_industry\}\}/g, sender?.industry || sender?.customIndustry || '');
    }

    private formatEmailContent(content: string, lead: Lead, subject: string, sender?: User): string {
        return this.emailService.wrapInBrandedTemplate(subject, this.applyVariables(content, lead, sender));
    }

    private substituteVariables(content: string, lead: Lead, sender?: User): string {
        return this.applyVariables(content, lead, sender);
    }

    private sanitizeLog(log: CommunicationLog): CommunicationLog {
        if (log?.user && typeof (log.user as any).password === 'string') {
            const { password, ...userWithoutPassword } = log.user as any;
            (log as any).user = userWithoutPassword;
        }
        return log;
    }

    async getLogs(leadId: string, _userId: string): Promise<CommunicationLog[]> {
        const logs = await this.logRepository.find({
            where: { leadId },
            relations: ['user', 'lead'],
            order: { sentAt: 'DESC' },
        });
        return logs.map((l) => this.sanitizeLog(l));
    }

    async getAllLogs(userId: string): Promise<CommunicationLog[]> {
        // Fetch user and permissions to determine access scope
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId } });

        if (permissions) {
            // Sub-user: get all logs for the company
            const logs = await this.logRepository.find({
                where: { companyName: user?.companyName },
                relations: ['user', 'lead'],
                order: { sentAt: 'DESC' },
            });
            return logs.map((l) => this.sanitizeLog(l));
        }

        // Regular user/Admin: get all logs they or their sub-users sent
        const logs = await this.logRepository.find({
            where: [
                { userId: userId },
                { adminId: userId }
            ],
            relations: ['user', 'lead'],
            order: { sentAt: 'DESC' },
        });
        return logs.map((l) => this.sanitizeLog(l));
    }

    async onModuleInit(): Promise<void> {
        await this.purgeOldLogs();
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async purgeOldLogs(): Promise<void> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const result = await this.logRepository.delete({
            sentAt: LessThan(cutoff),
        });
        this.logger.log(`Purged ${result.affected ?? 0} communication log(s) older than 7 days`);
    }
}
