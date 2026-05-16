import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1715000000000 implements MigrationInterface {
  name = 'InitialSchema1715000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`email\` varchar(254) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Agents
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`agents\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`type\` varchar(100) NOT NULL,
        \`provider\` enum('openai_compatible','omniroute','anthropic','gemini','ollama_local','custom_endpoint') NOT NULL,
        \`model\` varchar(200) NOT NULL,
        \`config_json\` json NOT NULL,
        \`is_default\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_agents_user\` (\`user_id\`),
        CONSTRAINT \`FK_agents_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Projects
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`description\` text,
        \`repository_url\` varchar(500) NOT NULL,
        \`default_branch\` varchar(100) NOT NULL,
        \`stack\` json,
        \`root_path\` varchar(500),
        \`test_command\` text,
        \`lint_command\` text,
        \`build_command\` text,
        \`default_agent_id\` int,
        \`ssh_key_path\` varchar(1000),
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_projects_user_updated\` (\`user_id\`, \`updated_at\`),
        CONSTRAINT \`FK_projects_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_projects_agent\` FOREIGN KEY (\`default_agent_id\`) REFERENCES \`agents\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Specs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`specs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`project_id\` int NOT NULL,
        \`title\` varchar(200) NOT NULL,
        \`summary\` text,
        \`status\` enum('Draft','Ready','In Progress','Verification','Completed','Archived') NOT NULL DEFAULT 'Draft',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_specs_project\` (\`project_id\`),
        CONSTRAINT \`FK_specs_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Spec Artifacts (append-only)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`spec_artifacts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`spec_id\` int NOT NULL,
        \`type\` enum('requirements','design','tasks') NOT NULL,
        \`content\` longtext NOT NULL,
        \`version\` int NOT NULL DEFAULT 1,
        \`parent_id\` int,
        \`is_current\` tinyint(1) NOT NULL DEFAULT 1,
        \`generated_by\` enum('llm','user') NOT NULL DEFAULT 'llm',
        \`change_summary\` text,
        \`created_by\` int,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_spec_artifacts_current\` (\`spec_id\`, \`type\`, \`is_current\`),
        CONSTRAINT \`FK_spec_artifacts_spec\` FOREIGN KEY (\`spec_id\`) REFERENCES \`specs\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tickets
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tickets\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`spec_id\` int NOT NULL,
        \`task_id\` varchar(50),
        \`title\` varchar(200) NOT NULL,
        \`description\` text,
        \`branch_name\` varchar(200),
        \`status\` enum('Backlog','Ready','Running','Waiting Review','Approved','Rejected','Failed','Merged','Cancelled') NOT NULL DEFAULT 'Backlog',
        \`agent_id\` int,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_tickets_spec\` (\`spec_id\`),
        CONSTRAINT \`FK_tickets_spec\` FOREIGN KEY (\`spec_id\`) REFERENCES \`specs\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_tickets_agent\` FOREIGN KEY (\`agent_id\`) REFERENCES \`agents\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Executions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`executions\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`ticket_id\` int NOT NULL,
        \`project_id\` int NOT NULL,
        \`agent_id\` int,
        \`status\` enum('Queued','Preparing Workspace','Running Agent','Running Verification','Waiting Review','Completed','Failed','Cancelled') NOT NULL DEFAULT 'Queued',
        \`error_message\` text,
        \`worktree_path\` varchar(500),
        \`branch_name\` varchar(200),
        \`exit_code\` int,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_executions_ticket\` (\`ticket_id\`),
        KEY \`IDX_executions_project\` (\`project_id\`),
        CONSTRAINT \`FK_executions_ticket\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`tickets\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Execution Logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`execution_logs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`execution_id\` int NOT NULL,
        \`level\` enum('info','warn','error','debug') NOT NULL DEFAULT 'info',
        \`source\` enum('agent','worker','system') NOT NULL DEFAULT 'agent',
        \`message\` text NOT NULL,
        \`metadata\` json,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_execution_logs\` (\`execution_id\`, \`created_at\`),
        CONSTRAINT \`FK_execution_logs_execution\` FOREIGN KEY (\`execution_id\`) REFERENCES \`executions\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // File Changes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`file_changes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`execution_id\` int NOT NULL,
        \`file_path\` varchar(1000) NOT NULL,
        \`change_type\` enum('added','modified','deleted') NOT NULL,
        \`additions\` int NOT NULL DEFAULT 0,
        \`deletions\` int NOT NULL DEFAULT 0,
        \`diff\` longtext,
        \`review_status\` enum('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_file_changes_execution\` (\`execution_id\`),
        CONSTRAINT \`FK_file_changes_execution\` FOREIGN KEY (\`execution_id\`) REFERENCES \`executions\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Verification Results
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`verification_results\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`execution_id\` int NOT NULL,
        \`type\` varchar(100) NOT NULL,
        \`command\` text,
        \`status\` enum('passed','failed','skipped','error') NOT NULL,
        \`exit_code\` int,
        \`output\` longtext,
        \`duration_ms\` int,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_verification_results_execution\` (\`execution_id\`),
        CONSTRAINT \`FK_verification_results_execution\` FOREIGN KEY (\`execution_id\`) REFERENCES \`executions\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Audit Logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int,
        \`action\` varchar(100) NOT NULL,
        \`resource_type\` varchar(100) NOT NULL,
        \`resource_id\` int,
        \`metadata\` json,
        \`ip_address\` varchar(45),
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migrations table (TypeORM compatible)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`typeorm_migrations\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`timestamp\` bigint NOT NULL,
        \`name\` varchar(255) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `audit_logs`');
    await queryRunner.query('DROP TABLE IF EXISTS `verification_results`');
    await queryRunner.query('DROP TABLE IF EXISTS `file_changes`');
    await queryRunner.query('DROP TABLE IF EXISTS `execution_logs`');
    await queryRunner.query('DROP TABLE IF EXISTS `executions`');
    await queryRunner.query('DROP TABLE IF EXISTS `tickets`');
    await queryRunner.query('DROP TABLE IF EXISTS `spec_artifacts`');
    await queryRunner.query('DROP TABLE IF EXISTS `specs`');
    await queryRunner.query('DROP TABLE IF EXISTS `projects`');
    await queryRunner.query('DROP TABLE IF EXISTS `agents`');
    await queryRunner.query('DROP TABLE IF EXISTS `users`');
  }
}
