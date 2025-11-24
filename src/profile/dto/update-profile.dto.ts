import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { UserRole, CompanySize, Industry } from '../../auth/enums/user.enums';
import { ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Role must be one of: Sales Representative, Sales Manager, Management, or other',
  })
  role?: UserRole;

  @ValidateIf((o) => o.role === UserRole.OTHER)
  @IsString()
  @MaxLength(255)
  customRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsEnum(CompanySize, {
    message: 'Company Size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+',
  })
  companySize?: CompanySize;

  @IsOptional()
  @IsEnum(Industry, {
    message: 'Invalid industry value',
  })
  industry?: Industry;

  @ValidateIf((o) => o.industry === Industry.OTHER)
  @IsString()
  @MaxLength(255)
  customIndustry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^https?:\/\/.+/i, {
    message: 'Website must be a valid URL (starting with http:// or https://)',
  })
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, {
    message: 'Please provide a valid phone number',
  })
  phoneNumber?: string;
}

