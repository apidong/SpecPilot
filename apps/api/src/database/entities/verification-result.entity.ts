import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Execution } from './execution.entity.js';

@Entity('verification_results')
export class VerificationResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  execution_id!: number;

  @ManyToOne(() => Execution, (e) => e.verification_results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: Execution;

  @Column({ length: 100 })
  type!: string; // test, lint, build, static-check, security, spec-compliance

  @Column({ type: 'text', nullable: true })
  command?: string;

  @Column({ type: 'enum', enum: ['passed', 'failed', 'skipped', 'error'] })
  status!: 'passed' | 'failed' | 'skipped' | 'error';

  @Column({ type: 'int', nullable: true })
  exit_code?: number;

  @Column({ type: 'longtext', nullable: true })
  output?: string;

  @Column({ type: 'int', nullable: true })
  duration_ms?: number;

  @CreateDateColumn()
  created_at!: Date;
}
