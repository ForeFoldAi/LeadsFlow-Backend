import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateTemplateDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['email', 'sms', 'whatsapp'])
    type: string;

    @IsString()
    @IsOptional()
    subject?: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    @IsString()
    @IsOptional()
    sector?: string;
}
