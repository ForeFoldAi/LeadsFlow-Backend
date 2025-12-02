import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CustomerCategory, LeadStatus, LeadSource } from '../enums/lead.enums';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'Full Name is required' })
  @MaxLength(255)
  @Matches(/^[A-Za-z\s.]+$/, {
    message: 'Only letters, spaces, and dots are allowed',
  })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone Number is required' })
  @MaxLength(50)
  phoneNumber: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  designation?: string;

  @IsEnum(CustomerCategory, {
    message: 'Customer Category must be either "existing" or "potential"',
  })
  @IsNotEmpty({ message: 'Customer Category is required' })
  customerCategory: CustomerCategory;

  @IsOptional()
  @IsDateString()
  lastContactedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastContactedBy?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  nextFollowupDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerInterestedIn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredCommunicationChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customCommunicationChannel?: string;

  @IsEnum(LeadSource, {
    message:
      'Lead Source must be one of: website, referral, linkedin, facebook, twitter, campaign, instagram, generated_by, on_field, other',
  })
  @IsNotEmpty({ message: 'Lead Source is required' })
  leadSource: LeadSource;

  @ValidateIf((o) => o.leadSource === LeadSource.OTHER)
  @IsString()
  @IsNotEmpty({ message: 'Custom Lead Source is required when Lead Source is "other"' })
  @MaxLength(255)
  customLeadSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customReferralSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customGeneratedBy?: string;

  @IsEnum(LeadStatus, {
    message:
      'Lead Status must be one of: new, followup, qualified, hot, converted, lost',
  })
  @IsNotEmpty({ message: 'Lead Status is required' })
  leadStatus: LeadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  leadCreatedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Additional notes cannot exceed 200 characters' })
  additionalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Sector cannot exceed 255 characters' })
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Custom Sector cannot exceed 255 characters' })
  customSector?: string;
}

