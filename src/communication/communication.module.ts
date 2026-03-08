import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { CommunicationLog } from '../entities/communication-log.entity';
import { Lead } from '../entities/lead.entity';
import { User } from '../entities/user.entity';
import { UserPermissions } from '../entities/user-permissions.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([CommunicationLog, Lead, User, UserPermissions]),
        AuthModule,
    ],
    controllers: [CommunicationController],
    providers: [CommunicationService],
    exports: [CommunicationService],
})
export class CommunicationModule { }
