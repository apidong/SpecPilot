import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add MariaDB-compatible "partial unique" for active executions per project.
 * MySQL/MariaDB does not support partial unique indexes natively.
 * Use generated column + unique index strategy.
 * Req 11.6
 */
export class ExecutionActiveUniqueIndex1715000001000 implements MigrationInterface {
  name = 'ExecutionActiveUniqueIndex1715000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add generated column that is 1 when active, NULL otherwise (allows multiple NULLs in unique index)
    await queryRunner.query(`
      ALTER TABLE \`executions\`
      ADD COLUMN \`is_active\` tinyint(1) AS (
        CASE WHEN \`status\` IN ('Queued', 'Preparing Workspace', 'Running Agent', 'Running Verification')
        THEN 1 ELSE NULL END
      ) STORED
    `);

    // Unique index on (project_id, is_active) - NULLs are not considered equal in MySQL unique index
    await queryRunner.query(`
      ALTER TABLE \`executions\`
      ADD UNIQUE KEY \`UNQ_active_execution_per_project\` (\`project_id\`, \`is_active\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`executions\` DROP KEY \`UNQ_active_execution_per_project\``);
    await queryRunner.query(`ALTER TABLE \`executions\` DROP COLUMN \`is_active\``);
  }
}
