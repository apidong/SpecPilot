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
import { Project } from './project.entity.js';
import { SpecArtifact } from './spec-artifact.entity.js';
import { Ticket } from './ticket.entity.js';
import type { SpecStatus } from '@specpilot/shared';

@Entity('specs')
export class Spec {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  project_id!: number;

  @ManyToOne(() => Project, (p) => p.specs)
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({
    type: 'enum',
    enum: ['Draft', 'Ready', 'In Progress', 'Verification', 'Completed', 'Archived'],
    default: 'Draft',
  })
  status!: SpecStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => SpecArtifact, (a) => a.spec)
  artifacts!: SpecArtifact[];

  @OneToMany(() => Ticket, (t) => t.spec)
  tickets!: Ticket[];
}
