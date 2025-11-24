import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryColumn({ type: 'varchar', length: 255, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'new_leads', type: 'boolean', default: true })
  newLeads: boolean;

  @Column({ name: 'follow_ups', type: 'boolean', default: true })
  followUps: boolean;

  @Column({ name: 'hot_leads', type: 'boolean', default: true })
  hotLeads: boolean;

  @Column({ name: 'conversions', type: 'boolean', default: true })
  conversions: boolean;

  @Column({ name: 'browser_push', type: 'boolean', default: false })
  browserPush: boolean;

  @Column({ name: 'daily_summary', type: 'boolean', default: false })
  dailySummary: boolean;

  @Column({ name: 'email_notifications', type: 'boolean', default: true })
  emailNotifications: boolean;

  @Column({ name: 'push_subscription', type: 'text', nullable: true })
  pushSubscription?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

