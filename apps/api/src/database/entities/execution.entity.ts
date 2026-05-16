import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Ticket } from './ticket.entity.js';
import { Agent } from './agent.entity.js';
import { ExecutionLog } from './execution-log.entity.js';
import { FileChange } from './file-change.entity.js';
import { VerificationResult } from './verification-result.entity.js';
import type { ExecutionStatus } from '@specpilot/shared';

@Entity('executions')
@Index(['ticket_id'])
@Index(['project_id', 'status'])
export class Execution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  ticket_id!: number;

  @ManyToOne(() => Ticket, (t) => t.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: Ticket;

  @Column()
  project_id!: number;

  @Column({ nullable: true })
  agent_id?: number;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent?: Agent;

  @Column({
    type: 'enum',
    enum: [
      'Queued',
      'Preparing Workspace',
      'Running Agent',
      'Running Verification',
      'Waiting Review',
      'Completed',
      'Failed',
      'Cancelled',
    ],
    default: 'Queued',
  })
  status!: ExecutionStatus;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ length: 500, nullable: true })
  worktree_path?: string;

  @Column({ length: 200, nullable: true })
  branch_name?: string;

  @Column({ type: 'int', nullable: true })
  exit_code?: number;

  @Column({ type: 'text', nullable: true })
  ask_agent_fix_comments?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => ExecutionLog, (l) => l.execution)
  logs!: ExecutionLog[];

  @OneToMany(() => FileChange, (f) => f.execution)
  file_changes!: FileChange[];

  @OneToMany(() => VerificationResult, (v) => v.execution)
  verification_results!: VerificationResult[];
}
