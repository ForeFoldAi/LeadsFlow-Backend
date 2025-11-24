export class NotificationSettingsResponseDto {
  newLeads: boolean;
  followUps: boolean;
  hotLeads: boolean;
  conversions: boolean;
  browserPush: boolean;
  dailySummary: boolean;
  emailNotifications: boolean;
  pushSubscription?: string;
}

export class SecuritySettingsResponseDto {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  sessionTimeout: string;
  apiKey?: string;
  lastPasswordChange?: Date;
  twoFactorMethod: string;
  lastTwoFactorSetup?: Date;
}

export class UserPreferencesResponseDto {
  defaultView: string;
  itemsPerPage: string;
  autoSave: boolean;
  compactMode: boolean;
  exportFormat: string;
  exportNotes: boolean;
}

export class ProfilePreferencesResponseDto {
  notifications: NotificationSettingsResponseDto;
  security: SecuritySettingsResponseDto;
  preferences: UserPreferencesResponseDto;
}

