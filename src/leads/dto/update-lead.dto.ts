import {
  IsString,
  IsOptional,
  IsEmail,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CustomerCategory, LeadStatus, LeadSource } from '../enums/lead.enums';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[A-Za-z\s.]+$/, {
    message: 'Only letters, spaces, and dots are allowed',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @ValidateIf((o) => o.dateOfBirth !== null && o.dateOfBirth !== '')
  @IsDateString()
  dateOfBirth?: string | null;

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

  @IsOptional()
  @IsEnum(CustomerCategory, {
    message: 'Customer Category must be either "existing" or "potential"',
  })
  customerCategory?: CustomerCategory;

  @IsOptional()
  @ValidateIf((o) => o.lastContactedDate !== null && o.lastContactedDate !== '')
  @IsDateString()
  lastContactedDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastContactedBy?: string;

  @IsOptional()
  @ValidateIf((o) => o.nextFollowupDate !== null && o.nextFollowupDate !== '')
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  nextFollowupDate?: string | null;

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

  @IsOptional()
  @IsEnum(LeadSource, {
    message:
      'Lead Source must be one of: website, referral, linkedin, facebook, twitter, campaign, instagram, generated_by, on_field, other',
  })
  leadSource?: LeadSource;

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

  @IsOptional()
  @IsEnum(LeadStatus, {
    message:
      'Lead Status must be one of: new, followup, qualified, hot, converted, lost',
  })
  leadStatus?: LeadStatus;

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

