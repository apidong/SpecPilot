import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add missing column + performance indexes identified in review.
 *
 * Columns:
 *   - executions.ask_agent_fix_comments: stores ask-agent-fix comments JSON
 *
 * Indexes:
 *   - executions(project_id, status)    – concurrent guard queries
 *   - tickets(spec_id, status)          – ticket list queries
 *   - file_changes(execution_id, review_status) – approve/reject queries
 *   - audit_logs(resource_type, created_at) – audit log queries
 */
export class AddMissingIndexesAndColumns1700000004 implements MigrationInterface {
  name = 'AddMissingIndexesAndColumns1700000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Missing column on executions
    await queryRunner.query(`
      ALTER TABLE \`executions\`
      ADD COLUMN \`ask_agent_fix_comments\` text NULL
    `);

    // Performance indexes
    await queryRunner.query(`
      ALTER TABLE \`executions\`
      ADD INDEX \`IDX_executions_project_status\` (\`project_id\`, \`status\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`tickets\`
      ADD INDEX \`IDX_tickets_spec_status\` (\`spec_id\`, \`status\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`file_changes\`
      ADD INDEX \`IDX_file_changes_execution_review\` (\`execution_id\`, \`review_status\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`audit_logs\`
      ADD INDEX \`IDX_audit_logs_resource_created\` (\`resource_type\`, \`created_at\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`audit_logs\` DROP INDEX \`IDX_audit_logs_resource_created\``);
    await queryRunner.query(`ALTER TABLE \`file_changes\` DROP INDEX \`IDX_file_changes_execution_review\``);
    await queryRunner.query(`ALTER TABLE \`tickets\` DROP INDEX \`IDX_tickets_spec_status\``);
    await queryRunner.query(`ALTER TABLE \`executions\` DROP INDEX \`IDX_executions_project_status\``);
    await queryRunner.query(`ALTER TABLE \`executions\` DROP COLUMN \`ask_agent_fix_comments\``);
  }
}
