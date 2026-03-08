import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';

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
}
