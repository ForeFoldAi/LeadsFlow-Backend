import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AddCustomSectorDto {
  @IsString()
  @IsNotEmpty({ message: 'Sector name is required' })
  @MaxLength(255, { message: 'Sector name cannot exceed 255 characters' })
  sector: string;
}

