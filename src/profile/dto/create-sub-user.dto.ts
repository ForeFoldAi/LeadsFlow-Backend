import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsBoolean,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../auth/enums/user.enums';

export class CreateSubUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Full Name is required' })
  fullName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirm Password is required' })
  confirmPassword: string;

  @IsEnum(UserRole, {
    message: 'Role must be Sales Representative, Sales Manager, or other',
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

  // Lead Access Permissions
  @IsOptional()
  @IsBoolean()
  canViewLeads?: boolean = true;

  @IsOptional()
  @IsBoolean()
  canEditLeads?: boolean = false;

  @IsOptional()
  @IsBoolean()
  canAddLeads?: boolean = false;
}

