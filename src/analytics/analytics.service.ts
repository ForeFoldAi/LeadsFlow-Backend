import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { LeadStatus, CustomerCategory } from '../leads/enums/lead.enums';
import { AnalyticsResponseDto, BasicMetricsDto, FollowupTimelineDto, LeadSourceBreakdownDto, LeadStatusBreakdownDto, CategoryBreakdownDto, CommunicationChannelDto, MonthlyTrendDto } from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
  ) {}

  async getAnalytics(userId: number, days: number = 7): Promise<AnalyticsResponseDto> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Check if user is a sub-user
    const userPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: userId.toString() },
      relations: ['parentUser'],
    });

    let effectiveUserId = userId;
    let companyName: string | undefined;

    if (userPermissions) {
      // Sub-user: get parent user and company
      // Use parent user from relation (already loaded)
      const parentUser = userPermissions.parentUser;
      if (!parentUser) {
        throw new NotFoundException(`Parent user (ID: ${userPermissions.parentUserId}) not found. Please contact your administrator.`);
      }
      effectiveUserId = parentUser.id as any;
      companyName = parentUser.companyName;
    } else {
      // Regular user: get their company
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      companyName = user?.companyName;
    }

    // Build query for all leads based on user type
    let allLeadsQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user');

    if (userPermissions && companyName) {
      // Sub-user: get all leads from same company (including management user)
      allLeadsQueryBuilder = allLeadsQueryBuilder.where('"user"."company_name" = :companyName', { companyName });
    } else {
      // Regular user: get only their own leads
      allLeadsQueryBuilder = allLeadsQueryBuilder.where('lead.userId = :userId', { userId });
    }

    const allLeads = await allLeadsQueryBuilder.getMany();

    // Get leads within the period
    let periodQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (userPermissions && companyName) {
      periodQueryBuilder = periodQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
    } else {
      periodQueryBuilder = periodQueryBuilder.andWhere('lead.userId = :userId', { userId });
    }

    const periodLeads = await periodQueryBuilder.getMany();

    // Calculate current week dates
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
    weekEnd.setHours(23, 59, 59, 999);

    // Get this week's leads
    let thisWeekQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.createdAt BETWEEN :weekStart AND :weekEnd', { weekStart, weekEnd });

    if (userPermissions && companyName) {
      thisWeekQueryBuilder = thisWeekQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
    } else {
      thisWeekQueryBuilder = thisWeekQueryBuilder.andWhere('lead.userId = :userId', { userId });
    }

    const thisWeekLeads = await thisWeekQueryBuilder.getMany();

    // Calculate current month dates
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get this month's leads
    let thisMonthQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.createdAt BETWEEN :monthStart AND :monthEnd', { monthStart, monthEnd });

    if (userPermissions && companyName) {
      thisMonthQueryBuilder = thisMonthQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
    } else {
      thisMonthQueryBuilder = thisMonthQueryBuilder.andWhere('lead.userId = :userId', { userId });
    }

    const thisMonthLeads = await thisMonthQueryBuilder.getMany();

    // Basic Metrics
    const basicMetrics = this.calculateBasicMetrics(
      allLeads,
      thisWeekLeads,
      thisMonthLeads,
    );

    // Follow-up Timeline
    const followupTimeline = await this.calculateFollowupTimeline(
      userPermissions && companyName ? companyName : undefined,
      effectiveUserId,
    );

    // Lead Source Breakdown
    const leadSourceBreakdown = this.calculateLeadSourceBreakdown(allLeads);

    // Lead Status Breakdown
    const leadStatusBreakdown = this.calculateLeadStatusBreakdown(allLeads);

    // Category Breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(allLeads);

    // Communication Channels
    const communicationChannels = this.calculateCommunicationChannels(allLeads);

    // Next 7 Days Follow-ups
    const next7DaysFollowups = await this.getNext7DaysFollowups(
      userPermissions && companyName ? companyName : undefined,
      effectiveUserId,
    );

    // Monthly Trends
    const monthlyTrends = this.calculateMonthlyTrends(periodLeads, days);

    return {
      basicMetrics,
      followupTimeline,
      leadSourceBreakdown,
      leadStatusBreakdown,
      categoryBreakdown,
      communicationChannels,
      next7DaysFollowups,
      monthlyTrends,
      period: {
        days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  private calculateBasicMetrics(
    allLeads: Lead[],
    thisWeekLeads: Lead[],
    thisMonthLeads: Lead[],
  ): BasicMetricsDto {
    const totalLeads = allLeads.length;
    const convertedLeads = allLeads.filter((l) => l.leadStatus === LeadStatus.CONVERTED).length;
    const hotLeads = allLeads.filter((l) => l.leadStatus === LeadStatus.HOT).length;
    const potentialCustomers = allLeads.filter((l) => l.customerCategory === CustomerCategory.POTENTIAL).length;
    
    const newThisWeek = thisWeekLeads.filter((l) => l.leadStatus === LeadStatus.NEW).length;
    const pendingFollowups = allLeads.filter((l) => 
      l.leadStatus === LeadStatus.FOLLOWUP && l.nextFollowupDate
    ).length;
    
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);
    
    const dueThisWeek = allLeads.filter((l) => {
      if (!l.nextFollowupDate) return false;
      const followupDate = new Date(l.nextFollowupDate);
      return followupDate >= today && followupDate <= weekEnd;
    }).length;
    
    const qualifiedLeads = allLeads.filter((l) => l.leadStatus === LeadStatus.QUALIFIED).length;
    const readyToConvert = allLeads.filter((l) => 
      l.leadStatus === LeadStatus.QUALIFIED || l.leadStatus === LeadStatus.HOT
    ).length;
    const highPriority = hotLeads;
    
    const convertedCustomers = thisMonthLeads.filter((l) => l.leadStatus === LeadStatus.CONVERTED).length;
    const lostOpportunities = thisMonthLeads.filter((l) => l.leadStatus === LeadStatus.LOST).length;
    
    // Calculate conversion rate (converted / total)
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    
    // Calculate success rate (converted / (converted + lost))
    const totalProcessed = convertedLeads + lostOpportunities;
    const successRate = totalProcessed > 0 ? (convertedLeads / totalProcessed) * 100 : 0;
    
    // Calculate average conversion time
    const convertedLeadsWithDates = allLeads.filter((l) => 
      l.leadStatus === LeadStatus.CONVERTED && l.createdAt && l.updatedAt
    );
    let avgConversionTime = 0;
    if (convertedLeadsWithDates.length > 0) {
      const totalDays = convertedLeadsWithDates.reduce((sum, lead) => {
        if (!lead.createdAt || !lead.updatedAt) return sum;
        const created = new Date(lead.createdAt);
        const updated = new Date(lead.updatedAt);
        const diffTime = Math.abs(updated.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      avgConversionTime = totalDays / convertedLeadsWithDates.length;
    }

    return {
      totalLeads,
      convertedLeads,
      hotLeads,
      potentialCustomers,
      newThisWeek,
      pendingFollowups,
      dueThisWeek,
      qualifiedLeads,
      readyToConvert,
      highPriority,
      convertedCustomers,
      lostOpportunities,
      conversionRate: Math.round(conversionRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      avgConversionTime: Math.round(avgConversionTime),
    };
  }

  private async calculateFollowupTimeline(
    companyName: string | undefined,
    effectiveUserId: number,
  ): Promise<FollowupTimelineDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    // Build queries based on user type
    let overdueQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.nextFollowupDate <= :yesterday', { yesterday: new Date(today.getTime() - 1) })
      .andWhere('lead.leadStatus != :converted', { converted: LeadStatus.CONVERTED });

    let dueThisWeekQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.nextFollowupDate BETWEEN :today AND :weekEnd', { today, weekEnd });

    let futureQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.nextFollowupDate >= :weekEnd', { weekEnd });

    if (companyName) {
      // Sub-user: filter by company
      overdueQueryBuilder = overdueQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
      dueThisWeekQueryBuilder = dueThisWeekQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
      futureQueryBuilder = futureQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
    } else {
      // Regular user: filter by userId
      overdueQueryBuilder = overdueQueryBuilder.andWhere('lead.userId = :userId', { userId: effectiveUserId });
      dueThisWeekQueryBuilder = dueThisWeekQueryBuilder.andWhere('lead.userId = :userId', { userId: effectiveUserId });
      futureQueryBuilder = futureQueryBuilder.andWhere('lead.userId = :userId', { userId: effectiveUserId });
    }

    // Get counts
    const overdue = await overdueQueryBuilder.getCount();
    const dueThisWeek = await dueThisWeekQueryBuilder.getCount();
    const future = await futureQueryBuilder.getCount();

    return {
      overdue,
      dueThisWeek,
      future,
    };
  }

  private calculateLeadSourceBreakdown(leads: Lead[]): LeadSourceBreakdownDto[] {
    const sourceMap = new Map<string, number>();
    const total = leads.length;

    leads.forEach((lead) => {
      const source = lead.leadSource || 'unknown';
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });

    return Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateLeadStatusBreakdown(leads: Lead[]): LeadStatusBreakdownDto[] {
    const statusMap = new Map<string, number>();
    const total = leads.length;

    leads.forEach((lead) => {
      const status = lead.leadStatus || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateCategoryBreakdown(leads: Lead[]): CategoryBreakdownDto[] {
    const categoryMap = new Map<string, number>();
    const total = leads.length;

    leads.forEach((lead) => {
      const category = lead.customerCategory || 'unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateCommunicationChannels(leads: Lead[]): CommunicationChannelDto[] {
    const channelMap = new Map<string, number>();
    const total = leads.length;

    leads.forEach((lead) => {
      const channel = lead.preferredCommunicationChannel || lead.customCommunicationChannel || 'unknown';
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    });

    return Array.from(channelMap.entries())
      .map(([channel, count]) => ({
        channel,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async getNext7DaysFollowups(
    companyName: string | undefined,
    effectiveUserId: number,
  ): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    let followupsQueryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.user', 'user')
      .where('lead.nextFollowupDate BETWEEN :today AND :weekEnd', { today, weekEnd })
      .orderBy('lead.nextFollowupDate', 'ASC');

    if (companyName) {
      // Sub-user: filter by company
      followupsQueryBuilder = followupsQueryBuilder.andWhere('"user"."company_name" = :companyName', { companyName });
    } else {
      // Regular user: filter by userId
      followupsQueryBuilder = followupsQueryBuilder.andWhere('lead.userId = :userId', { userId: effectiveUserId });
    }

    const followups = await followupsQueryBuilder.getMany();

    return followups.map((lead) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phoneNumber: lead.phoneNumber,
      nextFollowupDate: lead.nextFollowupDate,
      leadStatus: lead.leadStatus,
      customerCategory: lead.customerCategory,
    }));
  }

  private calculateMonthlyTrends(leads: Lead[], days: number): MonthlyTrendDto[] {
    const trends = new Map<string, { leads: number; converted: number; lost: number }>();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    leads.forEach((lead) => {
      if (!lead.createdAt) return;
      const created = new Date(lead.createdAt);
      if (created < startDate || created > endDate) return;

      const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      
      if (!trends.has(monthKey)) {
        trends.set(monthKey, { leads: 0, converted: 0, lost: 0 });
      }

      const trend = trends.get(monthKey);
      if (trend) {
        trend.leads++;

        if (lead.leadStatus === LeadStatus.CONVERTED) {
          trend.converted++;
        } else if (lead.leadStatus === LeadStatus.LOST) {
          trend.lost++;
        }
      }
    });

    return Array.from(trends.entries())
      .map(([month, data]) => ({
        month,
        leads: data.leads,
        converted: data.converted,
        lost: data.lost,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

