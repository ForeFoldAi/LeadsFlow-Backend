import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateCategory } from '../../entities/communication-template.entity';
import { AttachmentDto } from '../../communication/dto/attachment.dto';

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

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    sectors?: string[];

    @IsEnum(TemplateCategory)
    @IsOptional()
    category?: TemplateCategory;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];
}

export class BulkCreateTemplateDto {
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

    @IsArray()
    @IsString({ each: true })
    sectors: string[];

    @IsEnum(TemplateCategory)
    @IsOptional()
    category?: TemplateCategory;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];
}
