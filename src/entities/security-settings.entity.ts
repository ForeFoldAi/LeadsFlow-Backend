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

@Entity('security_settings')
@Index(['userId'])
export class SecuritySettings {
  @PrimaryColumn({ type: 'varchar', length: 255, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'login_notifications', type: 'boolean', default: true })
  loginNotifications: boolean;

  @Column({ name: 'session_timeout', type: 'varchar', length: 10, default: '30' })
  sessionTimeout: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  apiKey?: string;

  @Column({ name: 'last_password_change', type: 'timestamp', nullable: true })
  lastPasswordChange?: Date;

  @Column({ name: 'two_factor_method', type: 'text', default: 'email', nullable: false })
  twoFactorMethod: string;

  @Column({ name: 'two_factor_secret', type: 'text', nullable: true })
  twoFactorSecret?: string;

  @Column({ name: 'two_factor_backup_codes', type: 'jsonb', nullable: true })
  twoFactorBackupCodes?: string[];

  @Column({ name: 'last_two_factor_setup', type: 'timestamp', nullable: true })
  lastTwoFactorSetup?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

