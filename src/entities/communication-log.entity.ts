import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Lead } from './lead.entity';

@Entity('communication_logs')
export class CommunicationLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'lead_id', type: 'varchar', length: 255 })
    leadId: string;

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 50 })
    type: string; // 'email', 'sms', 'whatsapp'

    @Column({ type: 'varchar', length: 255, nullable: true })
    subject?: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'varchar', length: 50, default: 'sent' })
    status: string; // 'sent', 'failed', 'delivered'

    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage?: string | null;

    @Column({ name: 'admin_id', type: 'varchar', length: 255, nullable: true })
    adminId?: string;

    @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
    companyName?: string;

    @CreateDateColumn({ name: 'sent_at' })
    sentAt: Date;
}
