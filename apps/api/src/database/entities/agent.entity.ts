import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';
import type { AgentProvider } from '@specpilot/shared';

export interface AgentConfigJson {
  api_key?: string;
  base_url?: string;
  max_tokens?: number;
  temperature?: number;
  timeout_seconds?: number;
  [key: string]: unknown;
}

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @ManyToOne(() => User, (u) => u.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100 })
  type!: string; // CLI tool type (claude, opencode, codex, etc.)

  @Column({
    type: 'enum',
    enum: ['openai_compatible', 'omniroute', 'anthropic', 'gemini', 'ollama_local', 'custom_endpoint'],
  })
  provider!: AgentProvider;

  @Column({ length: 200 })
  model!: string;

  @Column({ type: 'json' })
  config_json!: AgentConfigJson;

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
