import { IsOptional, IsBoolean, IsEnum, IsString, IsIn } from 'class-validator';

export enum LeadViewType {
  TABLE = 'table',
  GRID = 'grid',
  LIST = 'list',
}

export class UpdateNotificationSettingsDto {
  // Email Notifications
  @IsOptional()
  @IsBoolean()
  newLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  followUps?: boolean;

  @IsOptional()
  @IsBoolean()
  hotLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  conversions?: boolean;

  @IsOptional()
  @IsBoolean()
  browserPush?: boolean;

  @IsOptional()
  @IsBoolean()
  dailySummary?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsString()
  pushSubscription?: string;
}

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  loginNotifications?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['15', '30', '60', '120', '240'], {
    message: 'Session Timeout must be one of: 15, 30, 60, 120, 240 (minutes)',
  })
  sessionTimeout?: string;
}

export class UpdateUserPreferencesDto {
  // Application Preferences
  @IsOptional()
  @IsEnum(LeadViewType, {
    message: 'Default Lead View must be one of: table, grid, list',
  })
  defaultView?: LeadViewType;

  @IsOptional()
  @IsString()
  @IsIn(['10', '20', '30', '40', '50', '100'], {
    message: 'Items Per Page must be one of: 10, 20, 30, 40, 50, 100',
  })
  itemsPerPage?: string;

  @IsOptional()
  @IsBoolean()
  autoSave?: boolean;

  @IsOptional()
  @IsBoolean()
  compactMode?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx', 'pdf'], {
    message: 'Export Format must be one of: csv, xlsx, pdf',
  })
  exportFormat?: string;

  @IsOptional()
  @IsBoolean()
  exportNotes?: boolean;
}

