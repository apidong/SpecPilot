import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  user_id?: number;

  @Column({ length: 100 })
  action!: string;

  @Column({ length: 100 })
  resource_type!: string;

  @Column({ nullable: true })
  resource_id?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ length: 45, nullable: true })
  ip_address?: string;

  @CreateDateColumn()
  created_at!: Date;
}
