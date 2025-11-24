import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
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
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('profile')
@UseGuards(TokenAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Get User Profile (Basic Info)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserProfile(@Request() req): Promise<UserResponseDto> {
    const userId = req.user.sub;
    return this.profileService.getUserProfile(userId);
  }

  // Profile Preferences Endpoints
  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  async getProfilePreferences(
    @Request() req,
  ): Promise<ProfilePreferencesResponseDto> {
    const userId = req.user.sub;
    return this.profileService.getProfilePreferences(userId);
  }

  @Put('preferences/notifications')
  @HttpCode(HttpStatus.OK)
  async updateNotificationSettings(
    @Request() req,
    @Body(ValidationPipe) updateDto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    const userId = req.user.sub;
    return this.profileService.updateNotificationSettings(userId, updateDto);
  }

  @Put('preferences/security')
  @HttpCode(HttpStatus.OK)
  async updateSecuritySettings(
    @Request() req,
    @Body(ValidationPipe) updateDto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettingsResponseDto> {
    const userId = req.user.sub;
    return this.profileService.updateSecuritySettings(userId, updateDto);
  }

  @Put('preferences/app')
  @HttpCode(HttpStatus.OK)
  async updateUserPreferences(
    @Request() req,
    @Body(ValidationPipe) updateDto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    const userId = req.user.sub;
    return this.profileService.updateUserPreferences(userId, updateDto);
  }

  // Sub-Users Management Endpoints
  @Get('sub-users')
  @HttpCode(HttpStatus.OK)
  async getAllSubUsers(@Request() req): Promise<SubUserResponseDto[]> {
    const parentUserId = req.user.sub;
    return this.profileService.getAllSubUsers(parentUserId);
  }

  @Post('sub-users')
  @HttpCode(HttpStatus.CREATED)
  async createSubUser(
    @Request() req,
    @Body(ValidationPipe) createDto: CreateSubUserDto,
  ): Promise<SubUserResponseDto> {
    const parentUserId = req.user.sub;
    return this.profileService.createSubUser(parentUserId, createDto);
  }

  @Patch('sub-users/:id/permissions')
  @HttpCode(HttpStatus.OK)
  async updateSubUserPermissions(
    @Request() req,
    @Param('id', ParseIntPipe) subUserId: number,
    @Body(ValidationPipe) updateDto: UpdateSubUserPermissionsDto,
  ): Promise<SubUserResponseDto> {
    const parentUserId = req.user.sub;
    return this.profileService.updateSubUserPermissions(
      parentUserId,
      subUserId,
      updateDto,
    );
  }

  @Delete('sub-users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSubUser(
    @Request() req,
    @Param('id', ParseIntPipe) subUserId: number,
  ): Promise<{ message: string }> {
    const parentUserId = req.user.sub;
    return this.profileService.deleteSubUser(parentUserId, subUserId);
  }

  // Profile Update Endpoints
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req,
    @Body(ValidationPipe) updateDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const userId = req.user.sub;
    return this.profileService.updateProfile(userId, updateDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const userId = req.user.sub;
    return this.profileService.changePassword(userId, changePasswordDto);
  }
}

