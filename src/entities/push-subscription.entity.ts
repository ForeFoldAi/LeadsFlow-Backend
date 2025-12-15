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

@Entity('push_subscriptions')
@Index(['userId'])
@Index(['endpoint'], { unique: true })
export class PushSubscription {
  @PrimaryColumn({ type: 'varchar', length: 500 })
  endpoint: string; // Unique endpoint URL from browser

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'subscription_data', type: 'text' })
  subscriptionData: string; // JSON string of the full subscription object

  @Column({ name: 'device_info', type: 'varchar', length: 100, nullable: true })
  deviceInfo?: string; // Optional: 'mobile', 'desktop', etc.

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

