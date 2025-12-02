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

@Entity('leads')
@Index(['userId'])
@Index(['leadStatus'])
@Index(['customerCategory'])
export class Lead {
  @PrimaryColumn({ type: 'varchar', length: 255, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 50 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pincode?: string;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  designation?: string;

  @Column({
    name: 'customer_category',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'potential',
  })
  customerCategory?: string;

  @Column({ name: 'last_contacted_date', type: 'date', nullable: true })
  lastContactedDate?: Date | null;

  @Column({ name: 'last_contacted_by', type: 'varchar', length: 255, nullable: true })
  lastContactedBy?: string;

  @Column({ name: 'next_followup_date', type: 'date', nullable: true })
  nextFollowupDate?: Date | null;

  @Column({ name: 'customer_interested_in', type: 'text', nullable: true })
  customerInterestedIn?: string;

  @Column({
    name: 'preferred_communication_channel',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  preferredCommunicationChannel?: string;

  @Column({
    name: 'custom_communication_channel',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customCommunicationChannel?: string;

  @Column({
    name: 'lead_source',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'website',
  })
  leadSource?: string;

  @Column({ name: 'custom_lead_source', type: 'varchar', length: 255, nullable: true })
  customLeadSource?: string;

  @Column({
    name: 'custom_referral_source',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customReferralSource?: string;

  @Column({ name: 'custom_generated_by', type: 'varchar', length: 255, nullable: true })
  customGeneratedBy?: string;

  @Column({
    name: 'lead_status',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'new',
  })
  leadStatus?: string;

  @Column({ name: 'lead_created_by', type: 'varchar', length: 255, nullable: true })
  leadCreatedBy?: string;

  @Column({ name: 'additional_notes', type: 'text', nullable: true })
  additionalNotes?: string;

  @Column({
    name: 'sector',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sector?: string;

  @Column({ name: 'custom_sector', type: 'varchar', length: 255, nullable: true })
  customSector?: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number; // Integer to match User.id

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt?: Date;
}

