import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number; // Single or double digit integer (1, 2, 3, ... 99)

  @Column({ name: 'name', type: 'varchar', length: 255 })
  fullName: string; // Maps to 'name' column in database

  @Column({ unique: true, type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'user',
  })
  role: string; // Changed to string to match existing varchar column

  @Column({ name: 'custom_role', type: 'varchar', length: 255, nullable: true })
  customRole?: string;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName?: string;

  @Column({ name: 'company_size', type: 'varchar', length: 50, nullable: true })
  companySize?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  industry?: string;

  @Column({ name: 'custom_industry', type: 'varchar', length: 255, nullable: true })
  customIndustry?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber?: string;

  @Column({
    name: 'subscription_status',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'trial',
  })
  subscriptionStatus?: string;

  @Column({
    name: 'subscription_plan',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'basic',
  })
  subscriptionPlan?: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: true, default: true })
  isActive?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt?: Date;
}

