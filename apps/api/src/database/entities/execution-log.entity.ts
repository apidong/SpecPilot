import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Execution } from './execution.entity.js';

@Entity('execution_logs')
@Index(['execution_id', 'created_at'])
export class ExecutionLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  execution_id!: number;

  @ManyToOne(() => Execution, (e) => e.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: Execution;

  @Column({ type: 'enum', enum: ['info', 'warn', 'error', 'debug'], default: 'info' })
  level!: 'info' | 'warn' | 'error' | 'debug';

  @Column({ type: 'enum', enum: ['agent', 'worker', 'system'], default: 'agent' })
  source!: 'agent' | 'worker' | 'system';

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;
}
