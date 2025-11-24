export class AuthResponseDto {
  // Standard login response fields
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: number; // Integer ID (1, 2, 3, ...)
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

