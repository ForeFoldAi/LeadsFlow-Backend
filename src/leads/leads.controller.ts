import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadResponseDto } from './dto/lead-response.dto';
import { PaginatedLeadsResponseDto } from './dto/paginated-leads-response.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { ImportLeadsResponseDto } from './dto/import-leads-response.dto';
import { GetLeadsQueryDto } from './dto/get-leads-query.dto';
import { AddCustomSectorDto } from './dto/add-custom-sector.dto';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('leads')
@UseGuards(TokenAuthGuard) // All leads endpoints require authentication
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('export')
  async exportLeads(
    @Request() req,
    @Res() res: Response,
    @Query(ValidationPipe) query: GetLeadsQueryDto,
  ) {
    const userId = req.user.sub; // Get userId from authenticated user
    const csv = await this.leadsService.exportToCsv(userId, query);

    // Set headers for CSV file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(csv);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllLeads(
    @Request() req,
    @Query(ValidationPipe) query: GetLeadsQueryDto,
  ): Promise<PaginatedLeadsResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.findAll(userId, query);
  }

  @Get('cities')
  @HttpCode(HttpStatus.OK)
  async getCities(@Request() req): Promise<{ cities: string[] }> {
    const userId = req.user.sub; // Get userId from authenticated user
    const cities = await this.leadsService.getDistinctCities(userId);
    return { cities };
  }

  @Get('sectors')
  @HttpCode(HttpStatus.OK)
  async getSectors(): Promise<{ sectors: string[] }> {
    return this.leadsService.getAllSectors();
  }

  @Post('sectors')
  @HttpCode(HttpStatus.CREATED)
  async addCustomSector(
    @Body(ValidationPipe) addCustomSectorDto: AddCustomSectorDto,
  ): Promise<{ message: string; sector: string }> {
    return this.leadsService.addCustomSector(addCustomSectorDto.sector);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getLeadById(@Request() req, @Param('id') id: string): Promise<LeadResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.findOne(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLead(
    @Request() req,
    @Body(ValidationPipe) createLeadDto: CreateLeadDto,
  ): Promise<LeadResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.create(createLeadDto, userId);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importLeads(
    @Request() req,
    @Body(ValidationPipe) importLeadsDto: ImportLeadsDto,
  ): Promise<ImportLeadsResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.importLeads(importLeadsDto.leads, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateLead(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateLeadDto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.update(id, userId, updateLeadDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteLead(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const userId = req.user.sub; // Get userId from authenticated user
    return this.leadsService.remove(id, userId);
  }

  @Post(':id/send-followup-reminder')
  @HttpCode(HttpStatus.OK)
  async sendFollowUpReminder(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const userId = req.user.sub; // Get userId from authenticated user
    await this.leadsService.sendFollowUpReminderForLead(id, userId);
    return { message: 'Follow-up reminder sent successfully' };
  }
}

