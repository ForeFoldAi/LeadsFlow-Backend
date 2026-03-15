import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CommunicationTemplate } from '../entities/communication-template.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { CreateTemplateDto, BulkCreateTemplateDto } from './dto/create-template.dto';
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

    private async resolveAdminAndCompany(userId: string): Promise<{ adminId: string; companyName?: string }> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId } });
        const adminId = permissions ? permissions.parentUserId : userId;
        const companyName = user ? user.companyName : undefined;
        return { adminId, companyName };
    }

    async create(createTemplateDto: CreateTemplateDto, userId: string): Promise<CommunicationTemplate> {
        const { adminId, companyName } = await this.resolveAdminAndCompany(userId);
        const { sectors, sector: singleSector, ...rest } = createTemplateDto;

        // Multiple sectors: store as one template with sectors array; sector = first for backward compat
        if (sectors && sectors.length > 0) {
            const template = this.templateRepository.create({
                ...rest,
                sector: sectors[0],
                sectors,
                userId,
                adminId,
                companyName,
            });
            return await this.templateRepository.save(template);
        }

        const template = this.templateRepository.create({
            ...createTemplateDto,
            userId,
            adminId,
            companyName,
        });
        return await this.templateRepository.save(template);
    }

    /** Creates a single template that applies to all given sectors (one template for multiple sectors). */
    async bulkCreate(dto: BulkCreateTemplateDto, userId: string): Promise<CommunicationTemplate> {
        const { adminId, companyName } = await this.resolveAdminAndCompany(userId);
        const { sectors, ...rest } = dto;
        const template = this.templateRepository.create({
            ...rest,
            sector: sectors[0],
            sectors,
            userId,
            adminId,
            companyName,
        });
        return await this.templateRepository.save(template);
    }

    async findAll(userId: string): Promise<CommunicationTemplate[]> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (user && user.companyName) {
            return await this.templateRepository.find({
                where: [
                    { userId },
                    { companyName: user.companyName },
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
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const permissions = await this.userPermissionsRepository.findOne({ where: { userId } });
        const adminId = permissions ? permissions.parentUserId : userId;

        // Allow access if the template belongs to the user or to their company
        let template: CommunicationTemplate | null = null;

        if (user && user.companyName) {
            template = await this.templateRepository.findOne({
                where: [
                    { id, userId },
                    { id, adminId },
                    { id, companyName: user.companyName },
                ],
            });
        } else {
            template = await this.templateRepository.findOne({
                where: [{ id, userId }, { id, adminId }],
            });
        }

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
        const user = await this.userRepository.findOne({ where: { id: userId } });
        const qb = this.templateRepository
            .createQueryBuilder('t')
            .where('t.type = :type', { type })
            .andWhere(
                new Brackets((qb2) => {
                    qb2
                        .where('t.sector = :sector', { sector })
                        .orWhere("t.sectors @> CAST(:sectorJson AS jsonb)", { sectorJson: JSON.stringify([sector]) });
                }),
            )
            .orderBy('t.createdAt', 'DESC');

        if (user && user.companyName) {
            qb.andWhere(
                new Brackets((qb2) => {
                    qb2.where('t.userId = :userId', { userId }).orWhere('t.companyName = :companyName', {
                        companyName: user.companyName,
                    });
                }),
            );
        } else {
            qb.andWhere('t.userId = :userId', { userId });
        }

        return qb.getMany();
    }
}
