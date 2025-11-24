import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Days must be an integer' })
  @Min(1, { message: 'Days must be at least 1' })
  @Max(365, { message: 'Days cannot exceed 365' })
  days?: number = 7; // Default to 7 days
}

