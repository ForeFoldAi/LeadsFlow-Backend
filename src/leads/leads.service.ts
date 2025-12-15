import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, FindOptionsWhere } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadResponseDto } from './dto/lead-response.dto';
import { GetLeadsQueryDto } from './dto/get-leads-query.dto';
import { PaginatedLeadsResponseDto } from './dto/paginated-leads-response.dto';
import { ImportLeadsResponseDto, ImportLeadResult } from './dto/import-leads-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CustomerCategory, LeadStatus, LeadSource, Sector } from './enums/lead.enums';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { CustomSector } from '../entities/custom-sector.entity';
import { EmailService } from '../auth/services/email.service';
import { PushNotificationService } from '../notifications/push-notification.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(CustomSector)
    private customSectorRepository: Repository<CustomSector>,
    private emailService: EmailService,
    private pushNotificationService: PushNotificationService,
  ) {}

  async findAll(
    userId: number,
    query: GetLeadsQueryDto,
  ): Promise<PaginatedLeadsResponseDto> {
    try {
      // Check if user is a sub-user
      const userPermissions = await this.userPermissionsRepository.findOne({
        where: { userId: userId.toString() },
        relations: ['parentUser'],
      });
      
      let effectiveUserId = userId;
      let companyName: string | undefined;
      let isSubUser = false;

      if (userPermissions) {
        // Sub-user: check permissions and get parent company
        isSubUser = true;
        if (!userPermissions.canViewLeads) {
          throw new ForbiddenException('You do not have permission to view leads');
        }
        
        // Use parent user from relation (already loaded)
        const parentUser = userPermissions.parentUser;
        
        if (!parentUser) {
          console.error('Parent user not found for sub-user:', userId);
          console.error('userPermissions.parentUserId:', userPermissions.parentUserId);
          throw new NotFoundException(
            `Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`
          );
        }
        
        if (!parentUser.isActive) {
          throw new ForbiddenException('Your parent account is inactive. Please contact your administrator.');
        }
        
        // Use parent user's ID (may be UUID string or number depending on DB schema)
        effectiveUserId = parentUser.id as any;
        companyName = parentUser.companyName;
      } else {
        // Regular user: get their company name for potential filtering
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        companyName = user.companyName;
      }

      // Build query with user relation
      // For sub-users: filter by company (all users with same company name, including management)
      // For regular users: filter by their own user ID
      let queryBuilder = this.leadRepository
        .createQueryBuilder('lead')
        .leftJoinAndSelect('lead.user', 'user'); // Load user relation

      if (isSubUser) {
        // Sub-user: see all leads from same company (including management user and other company members)
        if (!companyName) {
          // If no company name, fall back to showing only parent user's leads
          queryBuilder = queryBuilder.where('lead.user_id = :userId', { userId: effectiveUserId });
        } else {
          // Filter by company_name of the lead owner
          queryBuilder = queryBuilder.where(
            '"user"."company_name" = :companyName',
            { companyName },
          );
        }
      } else {
        // Regular user: see only their own leads
        queryBuilder = queryBuilder.where('lead.user_id = :userId', { userId });
      }

      // Apply filters
      if (query.status && query.status.length > 0) {
        queryBuilder = queryBuilder.andWhere('lead.leadStatus IN (:...statuses)', {
          statuses: query.status,
        });
      }

      if (query.category) {
        queryBuilder = queryBuilder.andWhere('lead.customerCategory = :category', {
          category: query.category,
        });
      }

      if (query.city) {
        queryBuilder = queryBuilder.andWhere('LOWER(lead.city) LIKE LOWER(:city)', {
          city: `%${query.city}%`,
        });
      }

      if (query.sector) {
        queryBuilder = queryBuilder.andWhere('LOWER(lead.sector) LIKE LOWER(:sector)', {
          sector: `%${query.sector}%`,
        });
      }

      // Search functionality
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        queryBuilder = queryBuilder.andWhere(
          '(LOWER(lead.name) LIKE LOWER(:search) OR LOWER(lead.email) LIKE LOWER(:search) OR LOWER(lead.phoneNumber) LIKE LOWER(:search) OR LOWER(lead.companyName) LIKE LOWER(:search))',
          { search: searchTerm },
        );
      }

      // Next Followup Date filter
      if (query.followupDateFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (query.followupDateFilter === 'overdue') {
          // Overdue: nextFollowupDate <= yesterday (and not converted)
          const yesterday = new Date(today.getTime() - 1);
          queryBuilder = queryBuilder
            .andWhere('lead.nextFollowupDate IS NOT NULL')
            .andWhere('lead.nextFollowupDate <= :yesterday', { yesterday })
            .andWhere('lead.leadStatus != :converted', { converted: LeadStatus.CONVERTED });
        } else if (query.followupDateFilter === 'due_soon') {
          // Due Soon: nextFollowupDate BETWEEN today AND weekEnd (next 7 days)
          const weekEnd = new Date(today);
          weekEnd.setDate(today.getDate() + 7);
          weekEnd.setHours(23, 59, 59, 999);
          queryBuilder = queryBuilder
            .andWhere('lead.nextFollowupDate IS NOT NULL')
            .andWhere('lead.nextFollowupDate >= :today', { today })
            .andWhere('lead.nextFollowupDate <= :weekEnd', { weekEnd });
        } else if (query.followupDateFilter === 'future') {
          // Future: nextFollowupDate >= weekEnd (beyond 7 days)
          const weekEnd = new Date(today);
          weekEnd.setDate(today.getDate() + 7);
          weekEnd.setHours(23, 59, 59, 999);
          queryBuilder = queryBuilder
            .andWhere('lead.nextFollowupDate IS NOT NULL')
            .andWhere('lead.nextFollowupDate >= :weekEnd', { weekEnd });
        }
      }

      // Order by created date (newest first)
      queryBuilder = queryBuilder.orderBy('lead.createdAt', 'DESC');

      // Pagination
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get total count before pagination (clone query to avoid affecting pagination)
      const total = await queryBuilder.getCount();

      // Apply pagination
      const leads = await queryBuilder.skip(skip).take(limit).getMany();

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        data: leads.map((lead) => this.mapToResponseDto(lead)),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };
    } catch (error) {
      // Log error for debugging
      console.error('Error in findAll:', error);
      throw error;
    }
  }

  async findOne(id: string, userId: number): Promise<LeadResponseDto> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
      relations: ['parentUser'],
    });

    let effectiveUserId = userId;
    let companyName: string | undefined;

    if (userPermissions) {
      // Sub-user: check permissions
      if (!userPermissions.canViewLeads) {
        throw new ForbiddenException('You do not have permission to view leads');
      }
      // Use parent user from relation (already loaded)
      const parentUser = userPermissions.parentUser;
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
      companyName = parentUser.companyName;
    }

    // Get the lead with user relation
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: ['user'], // Load user relation
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Check access: sub-users can see leads from same company (including management user)
    if (userPermissions && companyName) {
      const leadUser = await this.userRepository.findOne({
        where: { id: lead.userId },
      });
      // Sub-user can access if lead owner is from the same company
      if (leadUser?.companyName !== companyName) {
        throw new ForbiddenException('You do not have access to this lead');
      }
    } else if (lead.userId !== effectiveUserId) {
      // Regular user: can only see their own leads
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return this.mapToResponseDto(lead);
  }

  async create(createLeadDto: CreateLeadDto, userId: number): Promise<LeadResponseDto> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
    });

    if (userPermissions && !userPermissions.canAddLeads) {
      throw new ForbiddenException('You do not have permission to add leads');
    }

    // If sub-user, use parent user's ID for lead ownership
    let effectiveUserId = userId;
    if (userPermissions) {
      // Get parent user to use their ID
      const parentUser = await this.userRepository.findOne({
        where: { id: userPermissions.parentUserId as any },
      });
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
    }
    // Convert date strings to Date objects
    const leadData: Partial<Lead> = {
      name: createLeadDto.name,
      phoneNumber: createLeadDto.phoneNumber,
      email: createLeadDto.email,
      dateOfBirth: createLeadDto.dateOfBirth
        ? new Date(createLeadDto.dateOfBirth)
        : undefined,
      city: createLeadDto.city,
      state: createLeadDto.state,
      country: createLeadDto.country,
      pincode: createLeadDto.pincode,
      companyName: createLeadDto.companyName,
      designation: createLeadDto.designation,
      customerCategory: createLeadDto.customerCategory || CustomerCategory.POTENTIAL,
      lastContactedDate: createLeadDto.lastContactedDate
        ? new Date(createLeadDto.lastContactedDate)
        : undefined,
      lastContactedBy: createLeadDto.lastContactedBy,
      nextFollowupDate: createLeadDto.nextFollowupDate
        ? new Date(createLeadDto.nextFollowupDate)
        : undefined,
      customerInterestedIn: createLeadDto.customerInterestedIn,
      preferredCommunicationChannel: createLeadDto.preferredCommunicationChannel,
      customCommunicationChannel: createLeadDto.customCommunicationChannel,
      leadSource: createLeadDto.leadSource || LeadSource.WEBSITE,
      customLeadSource: createLeadDto.customLeadSource,
      customReferralSource: createLeadDto.customReferralSource,
      customGeneratedBy: createLeadDto.customGeneratedBy,
      leadStatus: createLeadDto.leadStatus || LeadStatus.NEW,
      leadCreatedBy: createLeadDto.leadCreatedBy,
      additionalNotes: createLeadDto.additionalNotes,
      sector: createLeadDto.sector,
      customSector: createLeadDto.customSector,
      userId: effectiveUserId, // Use effective user ID (parent if sub-user)
    };

    // If sector is provided, save it to custom_sectors table (if it's not already there)
    if (createLeadDto.sector) {
      await this.saveCustomSector(createLeadDto.sector);
    }

    const lead = this.leadRepository.create(leadData);
    const savedLead = await this.leadRepository.save(lead);

    // Reload with user relation
    const leadWithUser = await this.leadRepository.findOne({
      where: { id: savedLead.id },
      relations: ['user'], // Load user relation
    });

    // Send new lead notifications to ALL users (including creator) with delays between emails
    // Runs in background - doesn't block lead creation
    this.sendNewLeadNotifications(leadWithUser!).catch((error) => {
      console.error('Error sending new lead notifications:', error);
    });

    return this.mapToResponseDto(leadWithUser!);
  }

  async update(
    id: string,
    userId: number,
    updateLeadDto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
      relations: ['parentUser'],
    });

    if (userPermissions && !userPermissions.canEditLeads) {
      throw new ForbiddenException('You do not have permission to edit leads');
    }

    let effectiveUserId = userId;
    let companyName: string | undefined;

    if (userPermissions) {
      // Use parent user from relation (already loaded)
      const parentUser = userPermissions.parentUser;
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
      companyName = parentUser.companyName;
    }

    // Get the lead
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Check access: sub-users can edit leads from same company (including management user)
    if (userPermissions && companyName) {
      const leadUser = await this.userRepository.findOne({
        where: { id: lead.userId },
      });
      // Sub-user can edit if lead owner is from the same company
      if (leadUser?.companyName !== companyName) {
        throw new ForbiddenException('You do not have access to edit this lead');
      }
    } else if (lead.userId !== effectiveUserId) {
      // Regular user: can only edit their own leads
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Update only provided fields
    const updateData: Partial<Lead> = {};

    if (updateLeadDto.name !== undefined) updateData.name = updateLeadDto.name;
    if (updateLeadDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateLeadDto.phoneNumber;
    if (updateLeadDto.email !== undefined) updateData.email = updateLeadDto.email;
    if (updateLeadDto.dateOfBirth !== undefined)
      updateData.dateOfBirth = updateLeadDto.dateOfBirth
        ? new Date(updateLeadDto.dateOfBirth)
        : null;
    if (updateLeadDto.city !== undefined) updateData.city = updateLeadDto.city;
    if (updateLeadDto.state !== undefined) updateData.state = updateLeadDto.state;
    if (updateLeadDto.country !== undefined)
      updateData.country = updateLeadDto.country;
    if (updateLeadDto.pincode !== undefined)
      updateData.pincode = updateLeadDto.pincode;
    if (updateLeadDto.companyName !== undefined)
      updateData.companyName = updateLeadDto.companyName;
    if (updateLeadDto.designation !== undefined)
      updateData.designation = updateLeadDto.designation;
    if (updateLeadDto.customerCategory !== undefined)
      updateData.customerCategory = updateLeadDto.customerCategory;
    if (updateLeadDto.lastContactedDate !== undefined)
      updateData.lastContactedDate = updateLeadDto.lastContactedDate
        ? new Date(updateLeadDto.lastContactedDate)
        : null;
    if (updateLeadDto.lastContactedBy !== undefined)
      updateData.lastContactedBy = updateLeadDto.lastContactedBy;
    if (updateLeadDto.nextFollowupDate !== undefined)
      updateData.nextFollowupDate = updateLeadDto.nextFollowupDate
        ? new Date(updateLeadDto.nextFollowupDate)
        : null;
    if (updateLeadDto.customerInterestedIn !== undefined)
      updateData.customerInterestedIn = updateLeadDto.customerInterestedIn;
    if (updateLeadDto.preferredCommunicationChannel !== undefined)
      updateData.preferredCommunicationChannel =
        updateLeadDto.preferredCommunicationChannel;
    if (updateLeadDto.customCommunicationChannel !== undefined)
      updateData.customCommunicationChannel =
        updateLeadDto.customCommunicationChannel;
    if (updateLeadDto.leadSource !== undefined)
      updateData.leadSource = updateLeadDto.leadSource;
    if (updateLeadDto.customLeadSource !== undefined)
      updateData.customLeadSource = updateLeadDto.customLeadSource;
    if (updateLeadDto.customReferralSource !== undefined)
      updateData.customReferralSource = updateLeadDto.customReferralSource;
    if (updateLeadDto.customGeneratedBy !== undefined)
      updateData.customGeneratedBy = updateLeadDto.customGeneratedBy;
    if (updateLeadDto.leadStatus !== undefined)
      updateData.leadStatus = updateLeadDto.leadStatus;
    if (updateLeadDto.leadCreatedBy !== undefined)
      updateData.leadCreatedBy = updateLeadDto.leadCreatedBy;
    if (updateLeadDto.additionalNotes !== undefined)
      updateData.additionalNotes = updateLeadDto.additionalNotes;
    if (updateLeadDto.sector !== undefined)
      updateData.sector = updateLeadDto.sector;
    if (updateLeadDto.customSector !== undefined)
      updateData.customSector = updateLeadDto.customSector;

    // If sector is provided, save it to custom_sectors table (if it's not already there)
    if (updateLeadDto.sector) {
      await this.saveCustomSector(updateLeadDto.sector);
    }

    // Update the lead
    await this.leadRepository.update({ id, userId: lead.userId }, updateData);

    // Reload with user relation
    const updatedLead = await this.leadRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    return this.mapToResponseDto(updatedLead!);
  }

  async remove(id: string, userId: number): Promise<{ message: string }> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
      relations: ['parentUser'],
    });

    if (userPermissions && !userPermissions.canEditLeads) {
      throw new ForbiddenException('You do not have permission to delete leads');
    }

    let effectiveUserId = userId;
    let companyName: string | undefined;

    if (userPermissions) {
      // Use parent user from relation (already loaded)
      const parentUser = userPermissions.parentUser;
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
      companyName = parentUser.companyName;
    }

    // Get the lead
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Check access: sub-users can delete leads from same company (including management user)
    if (userPermissions && companyName) {
      const leadUser = await this.userRepository.findOne({
        where: { id: lead.userId },
      });
      // Sub-user can delete if lead owner is from the same company
      if (leadUser?.companyName !== companyName) {
        throw new ForbiddenException('You do not have access to delete this lead');
      }
    } else if (lead.userId !== effectiveUserId) {
      // Regular user: can only delete their own leads
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Delete the lead
    await this.leadRepository.remove(lead);

    return { message: 'Lead deleted successfully' };
  }

  async importLeads(
    leads: CreateLeadDto[],
    userId: number,
  ): Promise<ImportLeadsResponseDto> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
    });

    if (userPermissions && !userPermissions.canAddLeads) {
      throw new ForbiddenException('You do not have permission to import leads');
    }

    // If sub-user, use parent user's ID for lead ownership
    let effectiveUserId = userId;
    if (userPermissions) {
      // Get parent user to use their ID
      const parentUser = await this.userRepository.findOne({
        where: { id: userPermissions.parentUserId as any },
      });
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
    }
    const results: ImportLeadResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < leads.length; i++) {
      const leadDto = leads[i];
      const rowNumber = i + 1;

      try {
        // Create lead using the same logic as create method
        const leadData: Partial<Lead> = {
          name: leadDto.name,
          phoneNumber: leadDto.phoneNumber,
          email: leadDto.email,
          dateOfBirth: leadDto.dateOfBirth
            ? new Date(leadDto.dateOfBirth)
            : undefined,
          city: leadDto.city,
          state: leadDto.state,
          country: leadDto.country,
          pincode: leadDto.pincode,
          companyName: leadDto.companyName,
          designation: leadDto.designation,
          customerCategory: leadDto.customerCategory || CustomerCategory.POTENTIAL,
          lastContactedDate: leadDto.lastContactedDate
            ? new Date(leadDto.lastContactedDate)
            : undefined,
          lastContactedBy: leadDto.lastContactedBy,
          nextFollowupDate: leadDto.nextFollowupDate
            ? new Date(leadDto.nextFollowupDate)
            : undefined,
          customerInterestedIn: leadDto.customerInterestedIn,
          preferredCommunicationChannel: leadDto.preferredCommunicationChannel,
          customCommunicationChannel: leadDto.customCommunicationChannel,
          leadSource: leadDto.leadSource || LeadSource.WEBSITE,
          customLeadSource: leadDto.customLeadSource,
          customReferralSource: leadDto.customReferralSource,
          customGeneratedBy: leadDto.customGeneratedBy,
          leadStatus: leadDto.leadStatus || LeadStatus.NEW,
          leadCreatedBy: leadDto.leadCreatedBy,
          additionalNotes: leadDto.additionalNotes,
          sector: leadDto.sector,
          customSector: leadDto.customSector,
          userId: effectiveUserId, // Use effective user ID (parent if sub-user)
        };

        // If sector is provided, save it to custom_sectors table (if it's not already there)
        if (leadDto.sector) {
          await this.saveCustomSector(leadDto.sector);
        }

        const lead = this.leadRepository.create(leadData);
        const savedLead = await this.leadRepository.save(lead);

        // Reload with user relation
        const leadWithUser = await this.leadRepository.findOne({
          where: { id: savedLead.id },
          relations: ['user'],
        });

        if (leadWithUser) {
          results.push({
            success: true,
            lead: this.mapToResponseDto(leadWithUser),
            rowNumber,
          });
          successful++;
        } else {
          results.push({
            success: false,
            error: 'Failed to load created lead',
            rowNumber,
          });
          failed++;
        }
      } catch (error: any) {
        // Handle duplicate email or other errors
        const errorMessage =
          error.message || error.detail || 'Failed to create lead';
        results.push({
          success: false,
          error: errorMessage,
          rowNumber,
        });
        failed++;
      }
    }

    return {
      total: leads.length,
      successful,
      failed,
      results,
    };
  }

  async exportToCsv(userId: number, query: GetLeadsQueryDto): Promise<string> {
    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
    });

    if (userPermissions && !userPermissions.canViewLeads) {
      throw new ForbiddenException('You do not have permission to export leads');
    }

    let effectiveUserId = userId;
    if (userPermissions) {
      effectiveUserId = parseInt(userPermissions.parentUserId, 10);
    }

    // For export, we want all leads (no pagination limit, but max 1000)
    // Get leads without pagination for export - set high limit or get all
    const exportQuery = { ...query, page: 1, limit: 1000 };
    const paginatedResult = await this.findAll(effectiveUserId, exportQuery);
    const leads = paginatedResult.data;

    // Define CSV headers
    const headers = [
      'ID',
      'Name',
      'Phone Number',
      'Email',
      'Date of Birth',
      'City',
      'State',
      'Country',
      'Pincode',
      'Company Name',
      'Designation',
      'Customer Category',
      'Last Contacted Date',
      'Last Contacted By',
      'Next Followup Date',
      'Customer Interested In',
      'Preferred Communication Channel',
      'Custom Communication Channel',
      'Lead Source',
      'Custom Lead Source',
      'Custom Referral Source',
      'Custom Generated By',
      'Lead Status',
      'Lead Created By',
      'Additional Notes',
      'Sector',
      'Custom Sector',
      'Created At',
      'Updated At',
    ];

    // Helper function to escape CSV values
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // If value contains comma, newline, or quote, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Helper function to format date
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Build CSV content
    const csvRows = [headers.join(',')];

    leads.forEach((lead) => {
      const row = [
        escapeCsvValue(lead.id),
        escapeCsvValue(lead.name),
        escapeCsvValue(lead.phoneNumber),
        escapeCsvValue(lead.email),
        escapeCsvValue(formatDate(lead.dateOfBirth)),
        escapeCsvValue(lead.city),
        escapeCsvValue(lead.state),
        escapeCsvValue(lead.country),
        escapeCsvValue(lead.pincode),
        escapeCsvValue(lead.companyName),
        escapeCsvValue(lead.designation),
        escapeCsvValue(lead.customerCategory),
        escapeCsvValue(formatDate(lead.lastContactedDate)),
        escapeCsvValue(lead.lastContactedBy),
        escapeCsvValue(formatDate(lead.nextFollowupDate)),
        escapeCsvValue(lead.customerInterestedIn),
        escapeCsvValue(lead.preferredCommunicationChannel),
        escapeCsvValue(lead.customCommunicationChannel),
        escapeCsvValue(lead.leadSource),
        escapeCsvValue(lead.customLeadSource),
        escapeCsvValue(lead.customReferralSource),
        escapeCsvValue(lead.customGeneratedBy),
        escapeCsvValue(lead.leadStatus),
        escapeCsvValue(lead.leadCreatedBy),
        escapeCsvValue(lead.additionalNotes),
        escapeCsvValue(lead.sector),
        escapeCsvValue(lead.customSector),
        escapeCsvValue(lead.createdAt ? formatDate(lead.createdAt) : ''),
        escapeCsvValue(lead.updatedAt ? formatDate(lead.updatedAt) : ''),
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Helper method to get users by company name who should receive notifications
  // Returns ALL users in company including admins and sub-users (INCLUDING creator)
  private async getUsersForNotification(
    companyName: string | undefined,
    creatorUserId: number | string,
  ): Promise<User[]> {
    if (!companyName) {
      return [];
    }

    // Step 1: Get all active users with the same company name (by company name)
    const companyUsers = await this.userRepository.find({
      where: { companyName, isActive: true },
    });

    // Step 2: Get sub-users whose parent users are in the same company (by company name)
    // First, get all parent user IDs that belong to this company
    const parentUserIds = companyUsers.map((user) => user.id.toString());
    
    if (parentUserIds.length === 0) {
      // No company users found, return all company users (including creator)
      return companyUsers;
    }

    // Get all sub-user permissions where parent is in this company
    const subUserPermissions = await this.userPermissionsRepository
      .createQueryBuilder('up')
      .where('up.parent_user_id IN (:...parentIds)', { parentIds: parentUserIds })
      .getMany();

    // Get all sub-user IDs
    const subUserIds = subUserPermissions.map((perm) => perm.userId);

    // Get all sub-users who are active
    let subUsersInCompany: User[] = [];
    if (subUserIds.length > 0) {
      subUsersInCompany = await this.userRepository
        .createQueryBuilder('user')
        .where('user.id IN (:...subUserIds)', { subUserIds })
        .andWhere('user.is_active = :isActive', { isActive: true })
        .getMany();
    }

    // Step 3: Combine company users and sub-users, remove duplicates (by user ID)
    const allUsers = [...companyUsers, ...subUsersInCompany];
    const uniqueUsers = Array.from(
      new Map(allUsers.map((user) => [user.id, user])).values(),
    );

    // Step 4: Return ALL users including the creator (no filtering)
    return uniqueUsers;
  }

  // Helper method to check if user has new lead notifications enabled
  private async shouldSendNewLeadNotification(userId: number | string): Promise<boolean> {
    // Convert userId to string (handles both number and UUID string)
    const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
    
    // Try to find settings with exact match
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    // If not found, try querying all settings to debug
    if (!settings) {
      const allSettings = await this.notificationSettingsRepository.find();
      console.log(`No notification settings found for user ${userIdStr}. Available user IDs in settings:`, 
        allSettings.map(s => s.userId).slice(0, 5));
      console.log(`Defaulting to enabled for user ${userIdStr}`);
      return true;
    }

    // Log the actual settings values for debugging
    console.log(`Notification settings for user ${userIdStr}:`, {
      emailNotifications: settings.emailNotifications,
      newLeads: settings.newLeads,
      followUps: settings.followUps,
      browserPush: settings.browserPush,
      hasPushToken: settings.browserPush, // Check handled by push service
    });

    // Check if email notifications and new leads notifications are enabled
    const isEnabled = settings.emailNotifications && settings.newLeads;
    
    if (!isEnabled) {
      console.log(`❌ Notifications disabled for user ${userIdStr}: emailNotifications=${settings.emailNotifications}, newLeads=${settings.newLeads}`);
    } else {
      console.log(`✅ Notifications enabled for user ${userIdStr}`);
    }
    
    return isEnabled;
  }

  // Helper method to check if user has browser push notifications enabled and configured
  // Note: This only checks browserPush and token. The caller should also check the specific notification type (newLeads/followUps)
  private async shouldSendBrowserPushNotification(userId: number | string): Promise<boolean> {
    // Convert userId to string (handles both number and UUID string)
    const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
    
    const settings = await this.notificationSettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!settings) {
      console.log(`⏭️  [BROWSER PUSH] No notification settings found for user ${userIdStr}`);
      return false;
    }

    // Check if browser push is enabled (subscription check happens in push service)
    const isEnabled = settings.browserPush;
    
    if (!isEnabled) {
      console.log(`⏭️  [BROWSER PUSH] Browser push disabled for user ${userIdStr}: browserPush=${settings.browserPush}`);
    } else {
      console.log(`✅ [BROWSER PUSH] Browser push enabled for user ${userIdStr}`);
    }
    
    return isEnabled;
  }

  // Helper method to check if user has follow-up notifications enabled
  private async shouldSendFollowUpNotification(userId: number | string): Promise<boolean> {
    // Convert userId to string (handles both number and UUID string)
    const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
    
    const settings = await this.notificationSettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    // Default to true if no settings exist (backward compatibility)
    if (!settings) {
      console.log(`No notification settings found for user ${userIdStr}, defaulting to enabled`);
      return true;
    }

    // Check if email notifications and follow-up notifications are enabled
    const isEnabled = settings.emailNotifications && settings.followUps;
    
    if (!isEnabled) {
      console.log(`Follow-up notifications disabled for user ${userIdStr}: emailNotifications=${settings.emailNotifications}, followUps=${settings.followUps}`);
    }
    
    return isEnabled;
  }

  // Helper method to add delay between email sends (to avoid bulk sending)
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Send new lead notifications to all users in the same company
  // Notifications are based on both user ID and company name
  // Includes ALL users (admins, sub-users, and creator) based on their notification settings
  private async sendNewLeadNotifications(lead: Lead): Promise<void> {
    if (!lead.user) {
      return;
    }

    const companyName = lead.user.companyName;
    const creatorUserId = lead.userId;

    if (!companyName) {
      console.log(`Skipping notification: Lead ${lead.id} has no company name`);
      return;
    }

    // Get all users in the same company (based on company name)
    // This includes: direct company users (admins) + sub-users + creator
    const users = await this.getUsersForNotification(companyName, creatorUserId);

    console.log(`Found ${users.length} users in company "${companyName}" to potentially notify (INCLUDING creator ${creatorUserId}):`);
    users.forEach(user => {
      console.log(`  - User ID: ${user.id}, Email: ${user.email}, Name: ${user.fullName}`);
    });

    if (users.length === 0) {
      console.log(`No users to notify for company: ${companyName}`);
      return;
    }

    // Get the creator's name for the notification
    const createdByName = lead.user.fullName || lead.leadCreatedBy || 'Team member';

    // Send notifications to each user sequentially with delays (to avoid bulk sending)
    // Gap of 2 seconds between each email
    const EMAIL_DELAY_MS = 2000; // 2 seconds delay between emails
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      try {
        // Check notification settings for this specific user ID
        // Handle both number and UUID string user IDs
        const userId = user.id;
        console.log(`[${i + 1}/${users.length}] Checking notification settings for user ID: ${userId} (type: ${typeof userId}), email: ${user.email}`);
        
        // Get notification settings once
        const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
        const settings = await this.notificationSettingsRepository.findOne({
          where: { userId: userIdStr },
        });

        if (!settings) {
          console.log(`⏭️  No notification settings found for user ${userIdStr}, skipping notifications`);
          continue;
        }

        // Check if newLeads notifications are enabled (required for both email and push)
        const newLeadsEnabled = settings.newLeads;
        
        if (!newLeadsEnabled) {
          console.log(`✗ Skipping all notifications for user ${userId} (${user.email}): newLeads disabled`);
          continue;
        }

        let emailSent = false;

        // Send email notification if email notifications are enabled
        const shouldSendEmail = settings.emailNotifications && newLeadsEnabled;
        if (shouldSendEmail) {
          console.log(`✓ Sending email notification to user ${userId} (${user.email}) for company ${companyName}`);
          try {
            await this.emailService.sendNewLeadNotification(
              user.email,
              lead.name,
              lead.email,
              lead.phoneNumber,
              lead.companyName,
              createdByName,
            );
            console.log(`✅ Email sent successfully to ${user.email}`);
            emailSent = true;
          } catch (error) {
            console.error(`❌ Error sending email to user ${userId}:`, error);
          }
        } else {
          console.log(`⏭️  Skipping email notification for user ${userId}: emailNotifications=${settings.emailNotifications}`);
        }

        // Send browser push notification if browser push is enabled (independent of email)
        // The push service will check for actual subscriptions
        const shouldSendPush = settings.browserPush && newLeadsEnabled;
        if (shouldSendPush) {
          console.log(`✓ Sending browser push notification to user ${userId}`);
          // Send push notification (non-blocking)
          this.pushNotificationService.sendNewLeadNotification(
            userId.toString(),
            lead.name,
            lead.id as any,
          ).then(success => {
            if (success) {
              console.log(`✅ Browser push notification sent successfully to user ${userId}`);
            } else {
              console.log(`⚠️  Browser push notification failed for user ${userId} (check logs above)`);
            }
          }).catch(error => {
            console.error(`❌ Error sending browser push notification to user ${userId}:`, error);
          });
        } else {
          console.log(`⏭️  Skipping browser push notification for user ${userId}: browserPush=${settings.browserPush}, newLeads=${newLeadsEnabled}`);
        }
        
        // Add delay before sending next email (only if email was sent, to avoid bulk sending)
        if (emailSent && i < users.length - 1) {
          console.log(`⏳ Waiting ${EMAIL_DELAY_MS / 1000} seconds before sending next email...`);
          await this.delay(EMAIL_DELAY_MS);
        }
      } catch (error) {
        console.error(`❌ Error sending notification to user ${user.id} (${user.email}):`, error);
        // Continue with next user even if one fails
      }
    }
    
    console.log(`📧 Notification process completed for lead ${lead.id}. Processed ${users.length} users.`);
  }

  // Method to send follow-up reminders to ALL company users (can be called by scheduled job at 12:00 PM)
  // Sends reminders to all admins and sub-users in the company with delays between emails
  async sendFollowUpReminders(): Promise<{ sent: number; errors: number; skipped: number }> {
    console.log('🔔 Starting follow-up reminders job at:', new Date().toLocaleString());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all leads with follow-up dates today (using date range)
    const leads = await this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.nextFollowupDate >= :startDate', { startDate: today })
      .andWhere('lead.nextFollowupDate < :endDate', { endDate: tomorrow })
      .getMany();

    console.log(`📋 Found ${leads.length} leads with follow-up date today`);

    let sent = 0;
    let errors = 0;
    let skipped = 0;
    const EMAIL_DELAY_MS = 2000; // 2 seconds delay between emails

    // Process each lead
    for (const lead of leads) {
      if (!lead.user || !lead.nextFollowupDate) {
        console.log(`⏭️ Skipping lead ${lead.id}: missing user or follow-up date`);
        skipped++;
        continue;
      }

      const companyName = lead.user.companyName;
      if (!companyName) {
        console.log(`⏭️ Skipping lead ${lead.id}: no company name`);
        skipped++;
        continue;
      }

      console.log(`\n📧 Processing lead: ${lead.name} (ID: ${lead.id}) for company: ${companyName}`);

      // Get all users in the company (admins + sub-users)
      const companyUsers = await this.getUsersForNotification(companyName, lead.userId);

      console.log(`   Found ${companyUsers.length} users in company "${companyName}" to potentially notify:`);
      companyUsers.forEach(user => {
        console.log(`   - User ID: ${user.id}, Email: ${user.email}, Name: ${user.fullName}`);
      });

      if (companyUsers.length === 0) {
        console.log(`   No users found for company: ${companyName}`);
        skipped++;
        continue;
      }

      // Send reminder to each user in the company with delays
      for (let i = 0; i < companyUsers.length; i++) {
        const user = companyUsers[i];
        
        try {
          // Check if user has follow-up notifications enabled
          const userId = user.id;
          console.log(`   [${i + 1}/${companyUsers.length}] Checking notification settings for user ${userId} (${user.email})`);
          
          // Check notification settings (fetch once and reuse)
          const notificationSettings = await this.notificationSettingsRepository.findOne({
            where: { userId: userId.toString() },
          });
          
          // Check if follow-ups email notifications are enabled (for email)
          // For browser push, we check browserPush separately below
          const shouldNotifyEmail = notificationSettings && 
            notificationSettings.emailNotifications && 
            notificationSettings.followUps;
          
          if (!shouldNotifyEmail && (!notificationSettings || !notificationSettings.browserPush)) {
            console.log(`   ✗ Skipping user ${userId} (${user.email}): follow-up notifications disabled`);
            skipped++;
            continue;
          }

          // Send email notification if enabled
          if (shouldNotifyEmail) {
            console.log(`   ✓ Sending email follow-up reminder to user ${userId} (${user.email})`);
            await this.emailService.sendFollowUpReminder(
              user.email,
              lead.name,
              lead.nextFollowupDate,
              lead.email,
              lead.phoneNumber,
              lead.companyName,
              lead.additionalNotes,
            );
            console.log(`   ✅ Email sent successfully to ${user.email}`);
          } else {
            console.log(`   ⏭️  Skipping email for user ${userId} (${user.email}): email notifications or follow-ups disabled`);
          }
          
          // Send browser push notification if browserPush is enabled
          // No need to check followUps - if browserPush is true, send browser notifications automatically
          if (notificationSettings && notificationSettings.browserPush) {
            // Send push notification (non-blocking)
            this.pushNotificationService.sendFollowUpNotification(
              userId.toString(),
              lead.name,
              lead.id as any,
              lead.nextFollowupDate,
            ).then(success => {
              if (success) {
                console.log(`   ✅ Browser push notification sent successfully to user ${userId}`);
              } else {
                console.log(`   ⚠️  Browser push notification failed for user ${userId} (check logs above)`);
              }
            }).catch(error => {
              console.error(`   ❌ Error sending browser push notification to user ${userId}:`, error);
            });
          } else {
            console.log(`   ⏭️  Skipping browser push notification for user ${userId} (browser push not enabled)`);
          }
          
          sent++;

          // Add delay before sending next email (except for the last one)
          if (i < companyUsers.length - 1) {
            console.log(`   ⏳ Waiting ${EMAIL_DELAY_MS / 1000} seconds before sending next email...`);
            await this.delay(EMAIL_DELAY_MS);
          }
        } catch (error) {
          console.error(`   ❌ Error sending follow-up reminder to user ${user.id} (${user.email}):`, error);
          errors++;
        }
      }
    }

    console.log(`\n📊 Follow-up reminders job completed:`);
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);

    return { sent, errors, skipped };
  }

  // Method to send follow-up reminder for a specific lead to ALL company users (can be called manually)
  async sendFollowUpReminderForLead(leadId: string, userId: number): Promise<{ sent: number; skipped: number }> {
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: ['user'],
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    // Check access - user should be able to see this lead
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
      relations: ['parentUser'],
    });

    let hasAccess = false;
    if (lead.userId === userId) {
      hasAccess = true; // User owns the lead
    } else if (userPermissions) {
      // Sub-user: check if lead belongs to same company
      const parentUser = userPermissions.parentUser;
      if (parentUser && lead.user && parentUser.companyName === lead.user.companyName) {
        hasAccess = true;
      }
    } else {
      // Check if same company
      const requestingUser = await this.userRepository.findOne({ where: { id: userId } });
      if (requestingUser && lead.user && requestingUser.companyName === lead.user.companyName) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this lead');
    }

    if (!lead.nextFollowupDate) {
      throw new BadRequestException('This lead does not have a follow-up date set');
    }

    if (!lead.user) {
      throw new NotFoundException('Lead owner not found');
    }

    const companyName = lead.user.companyName;
    if (!companyName) {
      throw new BadRequestException('Lead does not have a company name');
    }

    // Get all users in the company (admins + sub-users)
    const companyUsers = await this.getUsersForNotification(companyName, lead.userId);

    console.log(`📧 Sending manual follow-up reminder for lead ${leadId} to ${companyUsers.length} users in company "${companyName}"`);

    let sent = 0;
    let skipped = 0;
    const EMAIL_DELAY_MS = 2000; // 2 seconds delay between emails

    // Send reminder to each user in the company with delays
    for (let i = 0; i < companyUsers.length; i++) {
      const user = companyUsers[i];
      
      try {
        // Check if user has follow-up notifications enabled
        const userIdToCheck = user.id;
        const shouldNotify = await this.shouldSendFollowUpNotification(userIdToCheck);
        
        if (!shouldNotify) {
          console.log(`✗ Skipping user ${userIdToCheck} (${user.email}): follow-up notifications disabled`);
          skipped++;
          continue;
        }

        console.log(`[${i + 1}/${companyUsers.length}] Sending follow-up reminder to ${user.email}`);
        await this.emailService.sendFollowUpReminder(
          user.email,
          lead.name,
          lead.nextFollowupDate,
          lead.email,
          lead.phoneNumber,
          lead.companyName,
          lead.additionalNotes,
        );
        console.log(`✅ Email sent successfully to ${user.email}`);
        
        // Check if browser push is enabled before sending push notification
        const shouldSendPush = await this.shouldSendBrowserPushNotification(userIdToCheck);
        if (shouldSendPush) {
          // Send push notification (non-blocking)
          this.pushNotificationService.sendFollowUpNotification(
            userIdToCheck.toString(),
            lead.name,
            lead.id as any,
            lead.nextFollowupDate,
          ).then(success => {
            if (success) {
              console.log(`✅ Browser push notification sent successfully to user ${userIdToCheck}`);
            } else {
              console.log(`⚠️  Browser push notification failed for user ${userIdToCheck} (check logs above)`);
            }
          }).catch(error => {
            console.error(`❌ Error sending browser push notification to user ${userIdToCheck}:`, error);
          });
        } else {
          console.log(`⏭️  Skipping browser push notification for user ${userIdToCheck} (browser push not enabled or no token)`);
        }
        
        sent++;

        // Add delay before sending next email (except for the last one)
        if (i < companyUsers.length - 1) {
          console.log(`⏳ Waiting ${EMAIL_DELAY_MS / 1000} seconds before sending next email...`);
          await this.delay(EMAIL_DELAY_MS);
        }
      } catch (error) {
        console.error(`❌ Error sending follow-up reminder to user ${user.id} (${user.email}):`, error);
        skipped++;
      }
    }

    console.log(`📊 Manual follow-up reminder completed: ${sent} sent, ${skipped} skipped`);
    return { sent, skipped };
  }

  async getDistinctCities(userId: number): Promise<string[]> {
    try {
      // Check if user is a sub-user
      const userPermissions = await this.userPermissionsRepository.findOne({
        where: { userId: userId.toString() },
        relations: ['parentUser'],
      });
      
      let effectiveUserId = userId;
      let companyName: string | undefined;
      let isSubUser = false;

      if (userPermissions) {
        // Sub-user: check permissions and get parent company
        isSubUser = true;
        if (!userPermissions.canViewLeads) {
          throw new ForbiddenException('You do not have permission to view leads');
        }
        
        // Use parent user from relation (already loaded)
        const parentUser = userPermissions.parentUser;
        
        if (!parentUser) {
          throw new NotFoundException(
            `Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`
          );
        }
        
        if (!parentUser.isActive) {
          throw new ForbiddenException('Your parent account is inactive. Please contact your administrator.');
        }
        
        // Use parent user's ID (may be UUID string or number depending on DB schema)
        effectiveUserId = parentUser.id as any;
        companyName = parentUser.companyName;
      } else {
        // Regular user: get their company name for potential filtering
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        companyName = user.companyName;
      }

      // Build query to get distinct cities
      let queryBuilder = this.leadRepository
        .createQueryBuilder('lead')
        .leftJoin('lead.user', 'user')
        .select('lead.city', 'city')
        .where('lead.city IS NOT NULL')
        .andWhere("lead.city != ''")
        .groupBy('lead.city');

      if (isSubUser) {
        // Sub-user: see all cities from same company (including management user and other company members)
        if (!companyName) {
          // If no company name, fall back to showing only parent user's leads
          queryBuilder = queryBuilder.andWhere('lead.user_id = :userId', { userId: effectiveUserId });
        } else {
          // Filter by company_name of the lead owner
          queryBuilder = queryBuilder.andWhere(
            '"user"."company_name" = :companyName',
            { companyName },
          );
        }
      } else {
        // Regular user: see only their own leads
        queryBuilder = queryBuilder.andWhere('lead.user_id = :userId', { userId });
      }

      const results = await queryBuilder
        .orderBy('lead.city', 'ASC')
        .getRawMany();

      // Extract city values and filter out null/empty values
      const cities = results
        .map((result) => result.city)
        .filter((city) => city && city.trim() !== '')
        .sort();

      return cities;
    } catch (error) {
      // Log error for debugging
      console.error('Error in getDistinctCities:', error);
      throw error;
    }
  }

  async getAllSectors(): Promise<{ sectors: string[] }> {
    try {
      // Get all custom sectors from database (no default sectors, only custom ones)
      const customSectors = await this.customSectorRepository.find({
        order: { sector: 'ASC' },
      });

      // Return only custom sectors
      const sectors = customSectors.map((cs) => cs.sector);

      return { sectors };
    } catch (error) {
      console.error('Error in getAllSectors:', error);
      throw error;
    }
  }

  async addCustomSector(sectorName: string): Promise<{ message: string; sector: string }> {
    try {
      const trimmedSectorName = sectorName.trim();

      if (!trimmedSectorName) {
        throw new BadRequestException('Sector name cannot be empty');
      }

      // Check if custom sector already exists (case-insensitive)
      const existingSector = await this.customSectorRepository
        .createQueryBuilder('customSector')
        .where('LOWER(customSector.sector) = LOWER(:sector)', {
          sector: trimmedSectorName,
        })
        .getOne();

      if (existingSector) {
        // Return existing sector instead of throwing error
        return {
          message: 'Sector already exists',
          sector: existingSector.sector,
        };
      }

      // Save new custom sector
      const customSector = this.customSectorRepository.create({
        sector: trimmedSectorName,
      });
      const savedSector = await this.customSectorRepository.save(customSector);

      return {
        message: 'Custom sector added successfully',
        sector: savedSector.sector,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error(`Error adding custom sector "${sectorName}":`, error);
      throw new BadRequestException(`Failed to add custom sector: ${error.message}`);
    }
  }

  private async saveCustomSector(sectorName: string): Promise<void> {
    try {
      // Check if custom sector already exists (case-insensitive)
      const existingSector = await this.customSectorRepository
        .createQueryBuilder('customSector')
        .where('LOWER(customSector.sector) = LOWER(:sector)', {
          sector: sectorName,
        })
        .getOne();

      if (!existingSector) {
        // Save new custom sector
        const customSector = this.customSectorRepository.create({
          sector: sectorName.trim(),
        });
        await this.customSectorRepository.save(customSector);
        console.log(`Saved new custom sector: ${sectorName}`);
      }
    } catch (error) {
      // Log error but don't fail the lead creation/update
      console.error(`Error saving custom sector "${sectorName}":`, error);
    }
  }

  private mapToResponseDto(lead: Lead): LeadResponseDto {
    // Map user data if available
    const userData: UserResponseDto | undefined = lead.user
      ? {
          id: lead.user.id,
          email: lead.user.email,
          fullName: lead.user.fullName,
          role: lead.user.customRole || lead.user.role,
          customRole: lead.user.customRole,
          companyName: lead.user.companyName,
          companySize: lead.user.companySize,
          industry: lead.user.industry,
          website: lead.user.website,
          phoneNumber: lead.user.phoneNumber,
          subscriptionStatus: lead.user.subscriptionStatus,
          subscriptionPlan: lead.user.subscriptionPlan,
          isActive: lead.user.isActive,
          createdAt: lead.user.createdAt,
          updatedAt: lead.user.updatedAt,
        }
      : undefined;

    return {
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      email: lead.email,
      dateOfBirth: lead.dateOfBirth,
      city: lead.city,
      state: lead.state,
      country: lead.country,
      pincode: lead.pincode,
      companyName: lead.companyName,
      designation: lead.designation,
      customerCategory: lead.customerCategory,
      lastContactedDate: lead.lastContactedDate,
      lastContactedBy: lead.lastContactedBy,
      nextFollowupDate: lead.nextFollowupDate,
      customerInterestedIn: lead.customerInterestedIn,
      preferredCommunicationChannel: lead.preferredCommunicationChannel,
      customCommunicationChannel: lead.customCommunicationChannel,
      leadSource: lead.leadSource,
      customLeadSource: lead.customLeadSource,
      customReferralSource: lead.customReferralSource,
      customGeneratedBy: lead.customGeneratedBy,
      leadStatus: lead.leadStatus,
      leadCreatedBy: lead.leadCreatedBy,
      additionalNotes: lead.additionalNotes,
      sector: lead.sector,
      customSector: lead.customSector,
      userId: lead.userId,
      user: userData, // Include full user data
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}

