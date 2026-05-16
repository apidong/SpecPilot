import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Spec } from './spec.entity.js';
import { Agent } from './agent.entity.js';
import { Execution } from './execution.entity.js';
import type { TicketStatus } from '@specpilot/shared';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  spec_id!: number;

  @ManyToOne(() => Spec, (s) => s.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spec_id' })
  spec!: Spec;

  @Column({ nullable: true })
  task_id?: string; // TSK-NNN code

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 200, nullable: true })
  branch_name?: string;

  @Column({
    type: 'enum',
    enum: ['Backlog', 'Ready', 'Running', 'Waiting Review', 'Approved', 'Rejected', 'Failed', 'Merged', 'Cancelled'],
    default: 'Backlog',
  })
  status!: TicketStatus;

  @Column({ nullable: true })
  agent_id?: number;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent?: Agent;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Execution, (e) => e.ticket)
  executions!: Execution[];
}
