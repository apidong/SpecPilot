import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Spec } from './spec.entity.js';
import type { ArtifactType } from '@specpilot/shared';

@Entity('spec_artifacts')
@Index(['spec_id', 'type', 'is_current'])
export class SpecArtifact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  spec_id!: number;

  @ManyToOne(() => Spec, (s) => s.artifacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spec_id' })
  spec!: Spec;

  @Column({
    type: 'enum',
    enum: ['requirements', 'design', 'tasks'],
  })
  type!: ArtifactType;

  @Column({ type: 'longtext' })
  content!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ nullable: true })
  parent_id?: number;

  @Column({ type: 'boolean', default: true })
  is_current!: boolean;

  @Column({
    type: 'enum',
    enum: ['llm', 'user'],
    default: 'llm',
  })
  generated_by!: 'llm' | 'user';

  @Column({ type: 'text', nullable: true })
  change_summary?: string;

  @Column({ nullable: true })
  created_by?: number;

  @CreateDateColumn()
  created_at!: Date;
}
