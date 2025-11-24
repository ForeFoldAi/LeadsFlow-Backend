import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { SecuritySettings } from '../entities/security-settings.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { UserRole, Industry } from '../auth/enums/user.enums';
import {
  UpdateNotificationSettingsDto,
  UpdateSecuritySettingsDto,
  UpdateUserPreferencesDto,
} from './dto/update-profile-preferences.dto';
import {
  ProfilePreferencesResponseDto,
  NotificationSettingsResponseDto,
  SecuritySettingsResponseDto,
  UserPreferencesResponseDto,
} from './dto/profile-preferences-response.dto';
import { CreateSubUserDto } from './dto/create-sub-user.dto';
import { SubUserResponseDto } from './dto/sub-user-response.dto';
import { UpdateSubUserPermissionsDto } from './dto/update-sub-user-permissions.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreferences)
    private userPreferencesRepository: Repository<UserPreferences>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(SecuritySettings)
    private securitySettingsRepository: Repository<SecuritySettings>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
  ) {}

  // Get User Profile Method
  async getUserProfile(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToUserResponse(user);
  }

  // Profile Preferences Methods
  async getProfilePreferences(userId: number): Promise<ProfilePreferencesResponseDto> {
    const userIdStr = userId.toString();

    // Get or create notification settings
    let notificationSettings = await this.notificationSettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!notificationSettings) {
      notificationSettings = this.notificationSettingsRepository.create({
        userId: userIdStr,
        newLeads: true,
        followUps: true,
        hotLeads: true,
        conversions: true,
        browserPush: false,
        dailySummary: false,
        emailNotifications: true,
      });
      notificationSettings = await this.notificationSettingsRepository.save(notificationSettings);
    }

    // Get or create security settings
    let securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!securitySettings) {
      securitySettings = this.securitySettingsRepository.create({
        userId: userIdStr,
        twoFactorEnabled: false,
        loginNotifications: true,
        sessionTimeout: '30',
        twoFactorMethod: 'email',
      });
      securitySettings = await this.securitySettingsRepository.save(securitySettings);
    }

    // Get or create user preferences
    let preferences = await this.userPreferencesRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!preferences) {
      preferences = this.userPreferencesRepository.create({
        userId: userIdStr,
        defaultView: 'table',
        itemsPerPage: '20',
        autoSave: true,
        compactMode: false,
        exportFormat: 'csv',
        exportNotes: true,
      });
      preferences = await this.userPreferencesRepository.save(preferences);
    }

    return {
      notifications: {
        newLeads: notificationSettings.newLeads,
        followUps: notificationSettings.followUps,
        hotLeads: notificationSettings.hotLeads,
        conversions: notificationSettings.conversions,
        browserPush: notificationSettings.browserPush,
        dailySummary: notificationSettings.dailySummary,
        emailNotifications: notificationSettings.emailNotifications,
        pushSubscription: notificationSettings.pushSubscription,
      },
      security: {
        twoFactorEnabled: securitySettings.twoFactorEnabled,
        loginNotifications: securitySettings.loginNotifications,
        sessionTimeout: securitySettings.sessionTimeout,
        apiKey: securitySettings.apiKey,
        lastPasswordChange: securitySettings.lastPasswordChange,
        twoFactorMethod: securitySettings.twoFactorMethod,
        lastTwoFactorSetup: securitySettings.lastTwoFactorSetup,
      },
      preferences: {
        defaultView: preferences.defaultView,
        itemsPerPage: preferences.itemsPerPage,
        autoSave: preferences.autoSave,
        compactMode: preferences.compactMode,
        exportFormat: preferences.exportFormat,
        exportNotes: preferences.exportNotes,
      },
    };
  }

  async updateNotificationSettings(
    userId: number,
    updateDto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    const userIdStr = userId.toString();
    console.log(`Updating notification settings for user ${userIdStr}:`, updateDto);
    
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!settings) {
      console.log(`Creating new notification settings for user ${userIdStr}`);
      settings = this.notificationSettingsRepository.create({
        userId: userIdStr,
        newLeads: updateDto.newLeads ?? true,
        followUps: updateDto.followUps ?? true,
        hotLeads: updateDto.hotLeads ?? true,
        conversions: updateDto.conversions ?? true,
        browserPush: updateDto.browserPush ?? false,
        dailySummary: updateDto.dailySummary ?? false,
        emailNotifications: updateDto.emailNotifications ?? true,
        pushSubscription: updateDto.pushSubscription,
      });
    } else {
      console.log(`Updating existing notification settings for user ${userIdStr}`);
      console.log(`Before update:`, {
        newLeads: settings.newLeads,
        followUps: settings.followUps,
        emailNotifications: settings.emailNotifications,
      });
      
      // Only update fields that are explicitly provided (not undefined)
      // IMPORTANT: If emailNotifications is false but user is enabling newLeads/followUps,
      // we should keep emailNotifications as true (don't disable master toggle when enabling specific notifications)
      if (updateDto.newLeads !== undefined) settings.newLeads = updateDto.newLeads;
      if (updateDto.followUps !== undefined) settings.followUps = updateDto.followUps;
      if (updateDto.hotLeads !== undefined) settings.hotLeads = updateDto.hotLeads;
      if (updateDto.conversions !== undefined) settings.conversions = updateDto.conversions;
      if (updateDto.browserPush !== undefined) settings.browserPush = updateDto.browserPush;
      if (updateDto.dailySummary !== undefined) settings.dailySummary = updateDto.dailySummary;
      
      // Only update emailNotifications if explicitly provided AND it's true
      // If user is enabling newLeads/followUps, don't disable emailNotifications
      if (updateDto.emailNotifications !== undefined) {
        // If user is enabling specific notifications, ensure emailNotifications is true
        if ((updateDto.newLeads === true || updateDto.followUps === true || 
             updateDto.hotLeads === true || updateDto.conversions === true) &&
            updateDto.emailNotifications === false) {
          console.log(`Warning: User trying to disable emailNotifications while enabling specific notifications. Keeping emailNotifications=true.`);
          settings.emailNotifications = true; // Keep it enabled
        } else {
          settings.emailNotifications = updateDto.emailNotifications;
        }
      } else {
        // If emailNotifications not provided but user is enabling notifications, ensure it's true
        if (updateDto.newLeads === true || updateDto.followUps === true || 
            updateDto.hotLeads === true || updateDto.conversions === true) {
          if (!settings.emailNotifications) {
            console.log(`Auto-enabling emailNotifications because user enabled specific notifications`);
            settings.emailNotifications = true;
          }
        }
      }
      
      if (updateDto.pushSubscription !== undefined) settings.pushSubscription = updateDto.pushSubscription;
      
      console.log(`After update:`, {
        newLeads: settings.newLeads,
        followUps: settings.followUps,
        emailNotifications: settings.emailNotifications,
      });
    }

    settings = await this.notificationSettingsRepository.save(settings);
    console.log(`Saved notification settings for user ${userIdStr}:`, {
      newLeads: settings.newLeads,
      followUps: settings.followUps,
      emailNotifications: settings.emailNotifications,
    });

    return {
      newLeads: settings.newLeads,
      followUps: settings.followUps,
      hotLeads: settings.hotLeads,
      conversions: settings.conversions,
      browserPush: settings.browserPush,
      dailySummary: settings.dailySummary,
      emailNotifications: settings.emailNotifications,
      pushSubscription: settings.pushSubscription,
    };
  }

  async updateSecuritySettings(
    userId: number,
    updateDto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettingsResponseDto> {
    const userIdStr = userId.toString();
    let settings = await this.securitySettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        userId: userIdStr,
        ...updateDto,
        twoFactorEnabled: updateDto.twoFactorEnabled ?? false,
        loginNotifications: updateDto.loginNotifications ?? true,
        sessionTimeout: updateDto.sessionTimeout ?? '30',
        twoFactorMethod: 'email',
      });
    } else {
      Object.assign(settings, updateDto);
    }

    settings = await this.securitySettingsRepository.save(settings);

    return {
      twoFactorEnabled: settings.twoFactorEnabled,
      loginNotifications: settings.loginNotifications,
      sessionTimeout: settings.sessionTimeout,
      apiKey: settings.apiKey,
      lastPasswordChange: settings.lastPasswordChange,
      twoFactorMethod: settings.twoFactorMethod,
      lastTwoFactorSetup: settings.lastTwoFactorSetup,
    };
  }

  async updateUserPreferences(
    userId: number,
    updateDto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    const userIdStr = userId.toString();
    let preferences = await this.userPreferencesRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!preferences) {
      preferences = this.userPreferencesRepository.create({
        userId: userIdStr,
        ...updateDto,
        defaultView: updateDto.defaultView ?? 'table',
        itemsPerPage: updateDto.itemsPerPage ?? '20',
        autoSave: updateDto.autoSave ?? true,
        compactMode: updateDto.compactMode ?? false,
        exportFormat: updateDto.exportFormat ?? 'csv',
        exportNotes: updateDto.exportNotes ?? true,
      });
    } else {
      Object.assign(preferences, updateDto);
    }

    preferences = await this.userPreferencesRepository.save(preferences);

    return {
      defaultView: preferences.defaultView,
      itemsPerPage: preferences.itemsPerPage,
      autoSave: preferences.autoSave,
      compactMode: preferences.compactMode,
      exportFormat: preferences.exportFormat,
      exportNotes: preferences.exportNotes,
    };
  }

  // Sub-User Management Methods
  async getAllSubUsers(parentUserId: number): Promise<SubUserResponseDto[]> {
    // Get parent user to verify role
    const parentUser = await this.userRepository.findOne({
      where: { id: parentUserId },
    });

    if (!parentUser) {
      throw new NotFoundException('Parent user not found');
    }

    // Only Management role users can view sub-users
    const userRole = parentUser.customRole || parentUser.role;
    if (userRole !== UserRole.MANAGEMENT) {
      throw new BadRequestException('Only Management role users can access sub-users');
    }

    const parentUserIdStr = parentUserId.toString();
    const permissions = await this.userPermissionsRepository.find({
      where: { parentUserId: parentUserIdStr },
      relations: ['user', 'parentUser'],
    });

    return permissions.map((perm) => this.mapToSubUserResponse(perm.user, perm));
  }

  async createSubUser(
    parentUserId: number,
    createDto: CreateSubUserDto,
  ): Promise<SubUserResponseDto> {
    // Get parent user to verify role and get company
    const parentUser = await this.userRepository.findOne({
      where: { id: parentUserId },
    });

    if (!parentUser) {
      throw new NotFoundException('Parent user not found');
    }

    // Only Management role users can create sub-users
    const userRole = parentUser.customRole || parentUser.role;
    if (userRole !== UserRole.MANAGEMENT) {
      throw new BadRequestException('Only Management role users can create sub-users');
    }

    // Validate password match
    if (createDto.password !== createDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate role (cannot be Management)
    if (createDto.role === UserRole.MANAGEMENT) {
      throw new BadRequestException('Sub-users cannot have Management role');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    // Create user - tag to parent user's company
    const userData: Partial<User> = {
      fullName: createDto.fullName,
      email: createDto.email,
      password: hashedPassword,
      role: createDto.role,
      customRole:
        createDto.role === UserRole.OTHER ? createDto.customRole : undefined,
      companyName: parentUser.companyName || createDto.companyName, // Use parent's company
      companySize: parentUser.companySize, // Inherit company size
      industry: parentUser.industry, // Inherit industry
      isActive: true,
      subscriptionStatus: parentUser.subscriptionStatus || 'trial',
      subscriptionPlan: parentUser.subscriptionPlan || 'basic',
    };

    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);

    // Create permissions
    const permissions = this.userPermissionsRepository.create({
      userId: savedUser.id.toString(),
      parentUserId: parentUserId.toString(),
      canViewLeads: createDto.canViewLeads ?? true,
      canEditLeads: createDto.canEditLeads ?? false,
      canAddLeads: createDto.canAddLeads ?? false,
    });

    await this.userPermissionsRepository.save(permissions);

    // Reload with permissions
    const savedPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: savedUser.id.toString() },
      relations: ['user', 'parentUser'],
    });

    return this.mapToSubUserResponse(savedUser, savedPermissions!);
  }

  async updateSubUserPermissions(
    parentUserId: number,
    subUserId: number,
    updateDto: UpdateSubUserPermissionsDto,
  ): Promise<SubUserResponseDto> {
    // Get parent user to verify role
    const parentUser = await this.userRepository.findOne({
      where: { id: parentUserId },
    });

    if (!parentUser) {
      throw new NotFoundException('Parent user not found');
    }

    // Only Management role users can update sub-user permissions
    const userRole = parentUser.customRole || parentUser.role;
    if (userRole !== UserRole.MANAGEMENT) {
      throw new BadRequestException('Only Management role users can update sub-user permissions');
    }

    // Verify the sub-user belongs to the parent user
    const permissions = await this.userPermissionsRepository.findOne({
      where: {
        userId: subUserId.toString(),
        parentUserId: parentUserId.toString(),
      },
      relations: ['user', 'parentUser'],
    });

    if (!permissions) {
      throw new NotFoundException('Sub-user not found or access denied');
    }

    Object.assign(permissions, updateDto);
    await this.userPermissionsRepository.save(permissions);

    // Reload
    const updatedPermissions = await this.userPermissionsRepository.findOne({
      where: { userId: subUserId.toString() },
      relations: ['user', 'parentUser'],
    });

    return this.mapToSubUserResponse(permissions.user, updatedPermissions!);
  }

  async deleteSubUser(parentUserId: number, subUserId: number): Promise<{ message: string }> {
    // Get parent user to verify role
    const parentUser = await this.userRepository.findOne({
      where: { id: parentUserId },
    });

    if (!parentUser) {
      throw new NotFoundException('Parent user not found');
    }

    // Only Management role users can delete sub-users
    const userRole = parentUser.customRole || parentUser.role;
    if (userRole !== UserRole.MANAGEMENT) {
      throw new BadRequestException('Only Management role users can delete sub-users');
    }

    // Verify the sub-user belongs to the parent user
    const permissions = await this.userPermissionsRepository.findOne({
      where: {
        userId: subUserId.toString(),
        parentUserId: parentUserId.toString(),
      },
    });

    if (!permissions) {
      throw new NotFoundException('Sub-user not found or access denied');
    }

    // Delete permissions and user (CASCADE will handle it)
    await this.userRepository.delete({ id: subUserId });

    return { message: 'Sub-user deleted successfully' };
  }

  // Profile Update Methods
  async updateProfile(
    userId: number,
    updateDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being updated and if it's already taken
    if (updateDto.email && updateDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateDto.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Email is already taken');
      }
    }

    // Update user fields
    if (updateDto.fullName !== undefined) {
      user.fullName = updateDto.fullName;
    }
    if (updateDto.email !== undefined) {
      user.email = updateDto.email;
    }
    if (updateDto.role !== undefined) {
      user.role = updateDto.role;
      // Clear customRole if role is not OTHER
      if (updateDto.role !== UserRole.OTHER) {
        user.customRole = undefined;
      } else if (updateDto.customRole !== undefined) {
        user.customRole = updateDto.customRole;
      }
    } else if (updateDto.customRole !== undefined && user.role === UserRole.OTHER) {
      user.customRole = updateDto.customRole;
    }
    if (updateDto.companyName !== undefined) {
      user.companyName = updateDto.companyName;
    }
    if (updateDto.companySize !== undefined) {
      user.companySize = updateDto.companySize;
    }
    if (updateDto.industry !== undefined) {
      user.industry = updateDto.industry;
      // Clear customIndustry if industry is not OTHER
      if (updateDto.industry !== Industry.OTHER) {
        user.customIndustry = undefined;
      } else if (updateDto.customIndustry !== undefined) {
        user.customIndustry = updateDto.customIndustry;
      }
    } else if (updateDto.customIndustry !== undefined && user.industry === Industry.OTHER) {
      user.customIndustry = updateDto.customIndustry;
    }
    if (updateDto.website !== undefined) {
      user.website = updateDto.website || undefined;
    }
    if (updateDto.phoneNumber !== undefined) {
      user.phoneNumber = updateDto.phoneNumber || undefined;
    }

    const updatedUser = await this.userRepository.save(user);

    return this.mapToUserResponse(updatedUser);
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    // Validate password match
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password', 'email'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    user.password = hashedNewPassword;
    await this.userRepository.save(user);

    // Update last password change in security settings
    const userIdStr = userId.toString();
    let securitySettings = await this.securitySettingsRepository.findOne({
      where: { userId: userIdStr },
    });

    if (!securitySettings) {
      securitySettings = this.securitySettingsRepository.create({
        userId: userIdStr,
        twoFactorEnabled: false,
        loginNotifications: true,
        sessionTimeout: '30',
        twoFactorMethod: 'email',
      });
    }

    securitySettings.lastPasswordChange = new Date();
    await this.securitySettingsRepository.save(securitySettings);

    return { message: 'Password changed successfully' };
  }

  private mapToUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.customRole || user.role,
      customRole: user.customRole,
      companyName: user.companyName || undefined,
      companySize: user.companySize || undefined,
      industry: user.customIndustry || user.industry || undefined,
      customIndustry: user.customIndustry,
      website: user.website || undefined,
      phoneNumber: user.phoneNumber || undefined,
      subscriptionStatus: user.subscriptionStatus || undefined,
      subscriptionPlan: user.subscriptionPlan || undefined,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private mapToSubUserResponse(
    user: User,
    permissions?: UserPermissions,
  ): SubUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.customRole || user.role,
      customRole: user.customRole,
      companyName: user.companyName,
      companySize: user.companySize,
      industry: user.customIndustry || user.industry,
      customIndustry: user.customIndustry,
      website: user.website,
      phoneNumber: user.phoneNumber,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      isActive: user.isActive,
      createdAt: user.createdAt,
      permissions: permissions
        ? {
            canViewLeads: permissions.canViewLeads,
            canEditLeads: permissions.canEditLeads,
            canAddLeads: permissions.canAddLeads,
          }
        : undefined,
      parentUserId: permissions?.parentUser
        ? permissions.parentUser.id
        : permissions?.parentUserId, // Return as string (UUID) if parentUser not loaded
    };
  }
}

