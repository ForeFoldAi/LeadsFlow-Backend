import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('two_factor_otps')
@Index(['expiresAt'])
@Index(['userId'])
@Index(['email'])
export class TwoFactorOtp {
  @PrimaryColumn({ type: 'varchar', length: 255, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string; // Column is varchar, store as string (user.id converted to string)

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User; // Optional since we manually manage the relationship

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  otp: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: false })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  used: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false })
  createdAt: Date;
}

