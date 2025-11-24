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

@Entity('user_permissions')
@Index(['userId'])
@Index(['parentUserId'])
export class UserPermissions {
  @PrimaryColumn({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'parent_user_id', type: 'varchar' })
  parentUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_user_id' })
  parentUser: User;

  // Lead Access Permissions
  @Column({ name: 'can_view_leads', type: 'boolean', default: true })
  canViewLeads: boolean;

  @Column({ name: 'can_edit_leads', type: 'boolean', default: false })
  canEditLeads: boolean;

  @Column({ name: 'can_add_leads', type: 'boolean', default: false })
  canAddLeads: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

