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
    Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, BulkCreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('templates')
@UseGuards(TokenAuthGuard)
export class TemplatesController {
    constructor(private readonly templatesService: TemplatesService) { }

    @Post()
    create(@Body() createTemplateDto: CreateTemplateDto, @Request() req) {
        return this.templatesService.create(createTemplateDto, req.user.id);
    }

    @Post('bulk')
    bulkCreate(@Body() dto: BulkCreateTemplateDto, @Request() req) {
        return this.templatesService.bulkCreate(dto, req.user.id);
    }

    @Get()
    findAll(@Request() req) {
        return this.templatesService.findAll(req.user.id);
    }

    @Get('filter')
    findBySector(
        @Query('type') type: string,
        @Query('sector') sector: string,
        @Request() req,
    ) {
        return this.templatesService.findBySector(type, sector, req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.templatesService.findOne(id, req.user.id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateTemplateDto: UpdateTemplateDto,
        @Request() req,
    ) {
        return this.templatesService.update(id, updateTemplateDto, req.user.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.templatesService.remove(id, req.user.id);
    }
}
