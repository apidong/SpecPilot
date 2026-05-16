import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity.js';
import { Project } from '../entities/project.entity.js';
import { Spec } from '../entities/spec.entity.js';
import { SpecArtifact } from '../entities/spec-artifact.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { Agent } from '../entities/agent.entity.js';
import { Execution } from '../entities/execution.entity.js';
import { ExecutionLog } from '../entities/execution-log.entity.js';
import { FileChange } from '../entities/file-change.entity.js';
import { VerificationResult } from '../entities/verification-result.entity.js';
import { AuditLog } from '../entities/audit-log.entity.js';

export const databaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 3306),
  username: config.get<string>('DB_USERNAME', 'root'),
  password: config.get<string>('DB_PASSWORD', ''),
  database: config.get<string>('DB_DATABASE', 'specpilot_db'),
  entities: [
    User,
    Project,
    Spec,
    SpecArtifact,
    Ticket,
    Agent,
    Execution,
    ExecutionLog,
    FileChange,
    VerificationResult,
    AuditLog,
  ],
  migrations: [__dirname + '/../migrations/*.js'],
  synchronize: config.get<boolean>('DB_SYNCHRONIZE', false),
  logging: config.get<boolean>('DB_LOGGING', false),
  charset: 'utf8mb4',
  timezone: '+00:00',
});
