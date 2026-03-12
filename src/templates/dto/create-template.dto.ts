import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { TemplateCategory } from '../../entities/communication-template.entity';

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

    @IsEnum(TemplateCategory)
    @IsOptional()
    category?: TemplateCategory;
}
