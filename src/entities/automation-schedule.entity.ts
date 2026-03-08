import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('automation_schedules')
export class AutomationSchedule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    channel: string; // 'email', 'sms', 'whatsapp'

    @Column({ type: 'varchar', length: 50 })
    frequency: string; // 'daily', 'weekly', 'custom'

    @Column({ type: 'varchar', length: 10 })
    time: string; // 'HH:mm'

    @Column({ type: 'varchar', length: 255, nullable: true })
    days?: string; // 'Mon,Wed,Fri' if frequency is custom

    @Column({ name: 'template_id', type: 'uuid', nullable: true })
    templateId?: string;

    @Column({ name: 'sms_message', type: 'text', nullable: true })
    smsMessage?: string;

    @Column({ name: 'whatsapp_message', type: 'text', nullable: true })
    whatsappMessage?: string;

    @Column({ name: 'target_filter', type: 'varchar', length: 100, default: 'due_followup' })
    targetFilter: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
    lastRunAt?: Date;

    @Column({ name: 'admin_id', type: 'varchar', length: 255, nullable: true })
    adminId?: string;

    @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
    companyName?: string;

    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
