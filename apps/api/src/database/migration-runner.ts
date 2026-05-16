import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'specpilot_db',
  entities: [],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  charset: 'utf8mb4',
  timezone: '+00:00',
  logging: process.env.DB_LOGGING === 'true',
});

async function run() {
  const command = process.argv[2];
  
  try {
    await AppDataSource.initialize();
    
    if (command === 'run') {
      await AppDataSource.runMigrations();
      console.log('Migrations executed successfully');
    } else if (command === 'revert') {
      await AppDataSource.undoLastMigration();
      console.log('Last migration reverted');
    } else if (command === 'generate') {
      console.log('Use TypeORM CLI to generate migrations');
    } else {
      console.log('Usage: ts-node migration-runner.ts [run|revert|generate]');
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
