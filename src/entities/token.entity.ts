import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('tokens')
@Index(['token'], { unique: true })
@Index(['userId'])
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number; // Integer to match User.id

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ unique: true, type: 'varchar', length: 512 })
  token: string; // 256 characters for hex tokens

  @Column({ name: 'token_type', type: 'varchar', length: 50 })
  tokenType: 'access' | 'refresh';

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

