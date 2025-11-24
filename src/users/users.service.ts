import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    // Map to response DTO (exclude password)
    return users.map((user) => this.mapToResponseDto(user));
  }

  async findOne(id: number): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return this.mapToResponseDto(user);
  }

  private mapToResponseDto(user: User): UserResponseDto {
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
      updatedAt: user.updatedAt,
    };
  }
}

