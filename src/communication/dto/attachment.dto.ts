import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class AttachmentDto {
    @IsUrl({ require_tld: false })
    url: string;

    @IsString()
    @IsNotEmpty()
    filename: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;
}
