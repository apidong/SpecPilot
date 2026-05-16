import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the typeorm_metadata table required by TypeORM 0.3.x for
 * view and check-constraint metadata tracking.
 */
export class AddTypeormMetadata1715000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`typeorm_metadata\` (
        \`type\` varchar(255) NOT NULL,
        \`database\` varchar(255) DEFAULT NULL,
        \`schema\` varchar(255) DEFAULT NULL,
        \`table\` varchar(255) DEFAULT NULL,
        \`name\` varchar(255) DEFAULT NULL,
        \`value\` text DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `typeorm_metadata`');
  }
}
