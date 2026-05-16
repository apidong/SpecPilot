// Load .env before any config modules run (paths.ts reads env vars at module level)
import 'dotenv/config';
import { createWorker } from './queue/consumer.js';

const worker = createWorker();

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log('[Worker] SpecPilot worker started. Listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down...');
  await worker.close();
  process.exit(0);
});
