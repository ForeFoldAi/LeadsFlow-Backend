import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationLog } from '../entities/communication-log.entity';
import { Lead } from '../entities/lead.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { EmailService } from '../auth/services/email.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class CommunicationService {
    private readonly logger = new Logger(CommunicationService.name);

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
    ) { }

    async sendMessage(sendMessageDto: SendMessageDto, userId: string): Promise<CommunicationLog> {
        const { leadId, type, subject, content } = sendMessageDto;

        this.logger.log(`Attempting to send ${type} to lead ${leadId} by user ${userId}`);
        const lead = await this.leadRepository.findOne({ where: { id: leadId } });
        if (!lead) {
            this.logger.error(`Lead ${leadId} not found`);
            throw new NotFoundException('Lead not found');
        }

        // Fetch user and permissions for tagging
        const user = await this.userRepository.findOne({ where: { id: userId } });
        this.logger.log(`Found user: ${user?.email || 'NOT FOUND'}`);
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId: userId } });

        const adminId = permissions ? permissions.parentUserId : userId;
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
                const htmlContent = this.formatEmailContent(content, lead, emailSubject);
                await this.emailService.sendMail(lead.email, emailSubject, htmlContent);
            } else if (type === 'sms' || type === 'whatsapp') {
                if (!lead.phoneNumber) {
                    throw new BadRequestException('Lead has no phone number');
                }
                // SMS/WhatsApp implementation placeholder (Twilio logic would go here)
                this.logger.log(`Sending ${type} to ${lead.phoneNumber}: ${content}`);
                // For now, we simulate success
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

        // Update lead's last contacted date if successful
        if (status === 'sent') {
            await this.leadRepository.update(leadId, {
                lastContactedDate: new Date(),
                lastContactedBy: userId,
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

    private formatEmailContent(content: string, lead: Lead, subject: string): string {
        // Handle personalization tokens
        const personalizedContent = content
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{company\}\}/g, lead.companyName || 'your company');

        // Wrap in professional branded template
        return this.emailService.wrapInBrandedTemplate(subject, personalizedContent);
    }

    private sanitizeLog(log: CommunicationLog): CommunicationLog {
        if (log?.user && typeof (log.user as any).password === 'string') {
            const { password, ...userWithoutPassword } = log.user as any;
            (log as any).user = userWithoutPassword;
        }
        return log;
    }

    async getLogs(leadId: string, userId: string): Promise<CommunicationLog[]> {
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
}
