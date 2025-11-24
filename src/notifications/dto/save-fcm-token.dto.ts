import { IsString, IsNotEmpty } from 'class-validator';

export class SaveFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

