import { createEmailWorker } from './emailWorker';

console.log('🚀 Starting standalone BullMQ Email Worker...');
const worker = createEmailWorker();

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down BullMQ Email Worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down BullMQ Email Worker...');
  await worker.close();
  process.exit(0);
});
