import { Controller, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { MAX_UPLOAD_SIZE, MediaService } from './media.service';

@Controller('media')
@UseGuards(TokenAuthGuard)
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_SIZE } }))
    async upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
        return await this.mediaService.upload(file, req.user.id);
    }
}
