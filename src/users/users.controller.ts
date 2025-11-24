import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('users')
@UseGuards(TokenAuthGuard) // All users endpoints require authentication
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUsers(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new NotFoundException(`Invalid user ID: ${id}`);
    }
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}

