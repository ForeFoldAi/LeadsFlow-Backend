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

export enum TemplateCategory {
  GENERAL = 'general',
  FOCUSED_TEMPLATE = 'focused_template',
  FOLLOWUP_TEMPLATE = 'followup_template',
}

@Entity('communication_templates')
export class CommunicationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'email', 'sms', 'whatsapp'

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sector?: string;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.GENERAL,
  })
  category: TemplateCategory;

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
