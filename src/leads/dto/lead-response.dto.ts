import { UserResponseDto } from '../../users/dto/user-response.dto';

export class LeadResponseDto {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth?: Date | string | null;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  companyName?: string;
  designation?: string;
  customerCategory?: string;
  lastContactedDate?: Date | string | null;
  lastContactedBy?: string;
  nextFollowupDate?: Date | string | null;
  customerInterestedIn?: string;
  preferredCommunicationChannel?: string;
  customCommunicationChannel?: string;
  leadSource?: string;
  customLeadSource?: string;
  customReferralSource?: string;
  customGeneratedBy?: string;
  leadStatus?: string;
  leadCreatedBy?: string;
  additionalNotes?: string;
  sector?: string;
  customSector?: string;
  userId: number;
  user?: UserResponseDto; // Include full user data
  createdAt?: Date;
  updatedAt?: Date;
}

