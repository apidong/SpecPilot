import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add unique constraint for default agent per user.
 * MySQL/MariaDB: use generated column + unique index for partial uniqueness.
 * Req 21.9, 21.10
 */
export class AgentDefaultUnique1715000002000 implements MigrationInterface {
  name = 'AgentDefaultUnique1715000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add generated column: value is user_id if is_default=1, NULL otherwise
    await queryRunner.query(`
      ALTER TABLE \`agents\`
      ADD COLUMN \`default_for_user\` int AS (
        CASE WHEN \`is_default\` = 1 THEN \`user_id\` ELSE NULL END
      ) STORED
    `);

    await queryRunner.query(`
      ALTER TABLE \`agents\`
      ADD UNIQUE KEY \`UNQ_default_agent_per_user\` (\`default_for_user\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`agents\` DROP KEY \`UNQ_default_agent_per_user\``);
    await queryRunner.query(`ALTER TABLE \`agents\` DROP COLUMN \`default_for_user\``);
  }
}
