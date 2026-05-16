import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Execution } from './execution.entity.js';

@Entity('file_changes')
export class FileChange {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  execution_id!: number;

  @ManyToOne(() => Execution, (e) => e.file_changes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: Execution;

  @Column({ length: 1000 })
  file_path!: string;

  @Column({ type: 'enum', enum: ['added', 'modified', 'deleted'] })
  change_type!: 'added' | 'modified' | 'deleted';

  @Column({ type: 'int', default: 0 })
  additions!: number;

  @Column({ type: 'int', default: 0 })
  deletions!: number;

  @Column({ type: 'longtext', nullable: true })
  diff?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'reviewed', 'approved', 'rejected'],
    default: 'pending',
  })
  review_status!: 'pending' | 'reviewed' | 'approved' | 'rejected';

  @CreateDateColumn()
  created_at!: Date;
}
