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
import { User } from './user.entity.js';
import { Spec } from './spec.entity.js';
import { Agent } from './agent.entity.js';

@Entity('projects')
@Index(['user_id', 'updated_at'])
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @ManyToOne(() => User, (u) => u.projects)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 500 })
  repository_url!: string;

  @Column({ length: 100 })
  default_branch!: string;

  @Column({ type: 'json', nullable: true })
  stack?: Record<string, unknown>;

  @Column({ length: 500, nullable: true })
  root_path?: string;

  @Column({ type: 'text', nullable: true })
  test_command?: string;

  @Column({ type: 'text', nullable: true })
  lint_command?: string;

  @Column({ type: 'text', nullable: true })
  build_command?: string;

  @Column({ nullable: true })
  default_agent_id?: number;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'default_agent_id' })
  default_agent?: Agent;

  @Column({ length: 1000, nullable: true, select: false })
  ssh_key_path?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Spec, (s) => s.project)
  specs!: Spec[];
}
