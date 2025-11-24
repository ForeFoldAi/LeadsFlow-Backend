import { UserResponseDto } from '../../users/dto/user-response.dto';

export class SubUserResponseDto extends UserResponseDto {
  permissions?: {
    canViewLeads: boolean;
    canEditLeads: boolean;
    canAddLeads: boolean;
  };
  parentUserId?: number | string; // Can be number (integer ID) or string (UUID)
}

