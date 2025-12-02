import { IsOptional, IsString, IsArray, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetLeadsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.includes(',') ? value.split(',').map((s) => s.trim()) : [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap((v) => (typeof v === 'string' && v.includes(',') ? v.split(',').map((s) => s.trim()) : v));
    }
    return value;
  })
  @IsArray()
  status?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  @IsIn(['overdue', 'due_soon', 'future'], {
    message: 'followupDateFilter must be one of: overdue, due_soon, future',
  })
  followupDateFilter?: 'overdue' | 'due_soon' | 'future';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(1000, { message: 'Limit cannot exceed 1000' })
  limit?: number = 10;
}

