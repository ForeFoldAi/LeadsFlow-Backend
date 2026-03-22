import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationScheduler } from './automation.scheduler';
import { AutomationSchedule } from '../entities/automation-schedule.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { CommunicationLog } from '../entities/communication-log.entity';
import { CommunicationModule } from '../communication/communication.module';
import { LeadsModule } from '../leads/leads.module';
import { TemplatesModule } from '../templates/templates.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AutomationSchedule, User, UserPermissions, CommunicationLog]),
        CommunicationModule,
        LeadsModule,
        TemplatesModule,
        AuthModule,
    ],
    controllers: [AutomationController],
    providers: [AutomationService, AutomationScheduler],
})
export class AutomationModule { }
