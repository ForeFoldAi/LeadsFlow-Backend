export class BasicMetricsDto {
  totalLeads: number;
  convertedLeads: number;
  hotLeads: number;
  potentialCustomers: number;
  newThisWeek: number;
  pendingFollowups: number;
  dueThisWeek: number;
  qualifiedLeads: number;
  readyToConvert: number;
  highPriority: number;
  convertedCustomers: number;
  lostOpportunities: number;
  conversionRate: number;
  successRate: number;
  avgConversionTime: number; // in days
}

export class FollowupTimelineDto {
  overdue: number;
  dueThisWeek: number;
  future: number;
}

export class LeadSourceBreakdownDto {
  source: string;
  count: number;
  percentage: number;
}

export class LeadStatusBreakdownDto {
  status: string;
  count: number;
  percentage: number;
}

export class CategoryBreakdownDto {
  category: string;
  count: number;
  percentage: number;
}

export class CommunicationChannelDto {
  channel: string;
  count: number;
  percentage: number;
}

export class MonthlyTrendDto {
  month: string; // Format: "YYYY-MM"
  leads: number;
  converted: number;
  lost: number;
}

export class AnalyticsResponseDto {
  basicMetrics: BasicMetricsDto;
  followupTimeline: FollowupTimelineDto;
  leadSourceBreakdown: LeadSourceBreakdownDto[];
  leadStatusBreakdown: LeadStatusBreakdownDto[];
  categoryBreakdown: CategoryBreakdownDto[];
  communicationChannels: CommunicationChannelDto[];
  next7DaysFollowups: any[]; // Array of leads due in next 7 days
  monthlyTrends: MonthlyTrendDto[];
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

