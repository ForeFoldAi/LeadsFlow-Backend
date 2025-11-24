import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { UserRole, CompanySize, Industry } from '../enums/user.enums';

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Full Name is required' })
  fullName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;

  @IsEnum(UserRole, {
    message: 'Role must be one of: Sales Representative, Sales Manager, Management, or other',
  })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @ValidateIf((o) => o.role === UserRole.OTHER)
  @IsString()
  @IsNotEmpty({ message: 'Specify Role is required when role is "other"' })
  customRole?: string;

  @IsString()
  @IsNotEmpty({ message: 'Company Name is required' })
  companyName: string;

  @IsEnum(CompanySize, {
    message:
      'Company Size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+',
  })
  @IsNotEmpty({ message: 'Company Size is required' })
  companySize: CompanySize;

  @IsEnum(Industry, {
    message: 'Industry must be one of the valid industry options',
  })
  @IsNotEmpty({ message: 'Industry is required' })
  industry: Industry;

  @ValidateIf((o) => o.industry === Industry.OTHER)
  @IsString()
  @IsNotEmpty({ message: 'Specify Industry is required when industry is "other"' })
  customIndustry?: string;

  @ValidateIf((o) => o.website && o.website.trim() !== '')
  @IsString()
  website?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirm Password is required' })
  confirmPassword: string;
}

