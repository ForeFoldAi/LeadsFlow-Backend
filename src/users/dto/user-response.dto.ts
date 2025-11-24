export class UserResponseDto {
  id: number; // Integer ID (1, 2, 3, ...)
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

