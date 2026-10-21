import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentDto } from './attachment.dto';

export class SendMessageDto {
    @IsUUID()
    @IsNotEmpty()
    leadId: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['email', 'sms', 'whatsapp'])
    type: string;

    @IsString()
    @IsOptional()
    subject?: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsUUID()
    @IsOptional()
    templateId?: string;

    @IsOptional()
    scheduleUpdatedAt?: Date;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];
}
