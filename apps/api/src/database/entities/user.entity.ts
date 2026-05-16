import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Project } from './project.entity.js';
import { Agent } from './agent.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 254 })
  email!: string;

  @Column({ select: false })
  password_hash!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Project, (p) => p.user)
  projects!: Project[];

  @OneToMany(() => Agent, (a) => a.user)
  agents!: Agent[];
}
