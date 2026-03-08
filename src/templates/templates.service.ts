import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationTemplate } from '../entities/communication-template.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
    constructor(
        @InjectRepository(CommunicationTemplate)
        private readonly templateRepository: Repository<CommunicationTemplate>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPermissions)
        private readonly userPermissionsRepository: Repository<UserPermissions>,
    ) { }

    async create(createTemplateDto: CreateTemplateDto, userId: string): Promise<CommunicationTemplate> {
        // Fetch user and permissions for tagging
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId: userId } });

        const adminId = permissions ? permissions.parentUserId : userId;
        const companyName = user ? user.companyName : undefined;

        const template = this.templateRepository.create({
            ...createTemplateDto,
            userId,
            adminId,
            companyName,
        });
        return await this.templateRepository.save(template);
    }

    async findAll(userId: string): Promise<CommunicationTemplate[]> {
        // Find templates where user is owner or they belong to the same company
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (user && user.companyName) {
            return await this.templateRepository.find({
                where: [
                    { userId },
                    { companyName: user.companyName }
                ],
                order: { createdAt: 'DESC' },
            });
        }

        return await this.templateRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string, userId: string): Promise<CommunicationTemplate> {
        const template = await this.templateRepository.findOne({
            where: { id, userId },
        });
        if (!template) {
            throw new NotFoundException(`Template with ID ${id} not found`);
        }
        return template;
    }

    async update(id: string, updateTemplateDto: UpdateTemplateDto, userId: string): Promise<CommunicationTemplate> {
        const template = await this.findOne(id, userId);
        Object.assign(template, updateTemplateDto);
        return await this.templateRepository.save(template);
    }

    async remove(id: string, userId: string): Promise<void> {
        const template = await this.findOne(id, userId);
        await this.templateRepository.remove(template);
    }

    async findBySector(type: string, sector: string, userId: string): Promise<CommunicationTemplate[]> {
        return await this.templateRepository.find({
            where: { type, sector, userId },
            order: { createdAt: 'DESC' },
        });
    }
}
