export class UserResponseDto {
  id: string; // User ID (UUID string)
  email: string;
  fullName: string;
  role: string;
  customRole?: string;
  companyName?: string;
  companySize?: string;
  industry?: string;
  customIndustry?: string;
  website?: string;
  phoneNumber?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

