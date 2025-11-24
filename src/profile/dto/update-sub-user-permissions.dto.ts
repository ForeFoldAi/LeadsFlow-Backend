import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateSubUserPermissionsDto {
  @IsOptional()
  @IsBoolean()
  canViewLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  canAddLeads?: boolean;
}

