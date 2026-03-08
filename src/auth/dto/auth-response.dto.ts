export class AuthResponseDto {
  // Standard login response fields
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string; // UUID string ID
    email: string;
    fullName: string;
    role: string;
    companyName?: string;
  };

  // Two-Factor Authentication fields
  requiresTwoFactor?: boolean;
  message?: string;
  email?: string;
}

