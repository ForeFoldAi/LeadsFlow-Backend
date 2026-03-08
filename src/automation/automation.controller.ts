import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('automation/schedules')
@UseGuards(TokenAuthGuard)
export class AutomationController {
    constructor(private readonly automationService: AutomationService) { }

    @Post()
    create(@Body() createScheduleDto: CreateScheduleDto, @Request() req) {
        return this.automationService.create(createScheduleDto, req.user.id);
    }

    @Get()
    findAll(@Request() req) {
        return this.automationService.findAll(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.automationService.findOne(id, req.user.id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateScheduleDto: UpdateScheduleDto,
        @Request() req,
    ) {
        return this.automationService.update(id, updateScheduleDto, req.user.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.automationService.remove(id, req.user.id);
    }

    @Post(':id/run')
    runSchedule(@Param('id') id: string, @Request() req) {
        return this.automationService.runSchedule(id, req.user.id);
    }
}
