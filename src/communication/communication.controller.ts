import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('communication')
@UseGuards(TokenAuthGuard)
export class CommunicationController {
    constructor(private readonly communicationService: CommunicationService) { }

    @Post('send')
    async sendMessage(@Body() sendMessageDto: SendMessageDto, @Request() req) {
        return await this.communicationService.sendMessage(sendMessageDto, req.user.id);
    }

    @Get('logs')
    async findAll(@Request() req) {
        return await this.communicationService.getAllLogs(req.user.id);
    }

    @Get('logs/:leadId')
    async getLogs(@Param('leadId') leadId: string, @Request() req) {
        return await this.communicationService.getLogs(leadId, req.user.id);
    }
}
