import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('analytics')
@UseGuards(TokenAuthGuard) // All analytics endpoints require authentication
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAnalytics(
    @Request() req,
    @Query(ValidationPipe) query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    const days = query.days || 7; // Default to 7 days
    return this.analyticsService.getAnalytics(userId, days);
  }
}

