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

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryColumn({ type: 'varchar', length: 255, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'default_view', type: 'varchar', length: 50, default: 'table' })
  defaultView: string;

  @Column({ name: 'items_per_page', type: 'varchar', length: 10, default: '20' })
  itemsPerPage: string;

  @Column({ name: 'auto_save', type: 'boolean', default: true })
  autoSave: boolean;

  @Column({ name: 'compact_mode', type: 'boolean', default: false })
  compactMode: boolean;

  @Column({ name: 'export_format', type: 'varchar', length: 10, default: 'csv' })
  exportFormat: string;

  @Column({ name: 'export_notes', type: 'boolean', default: true })
  exportNotes: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

