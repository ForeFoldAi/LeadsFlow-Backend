import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsUUID } from 'class-validator';

export class CreateScheduleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['email', 'sms', 'whatsapp'])
    channel: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['daily', 'weekly', 'custom'])
    frequency: string;

    @IsString()
    @IsNotEmpty()
    time: string; // 'HH:mm'

    @IsString()
    @IsOptional()
    days?: string;

    @IsUUID()
    @IsOptional()
    templateId?: string;

    @IsString()
    @IsOptional()
    smsMessage?: string;

    @IsString()
    @IsOptional()
    whatsappMessage?: string;

    @IsString()
    @IsOptional()
    targetFilter?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
