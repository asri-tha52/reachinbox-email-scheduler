import app from './app';
import config from './config';
import prisma from './config/database';
import redisClient from './config/redis';
import { emailWorker } from './workers/emailWorker';
import { emailQueue } from './queues/emailQueue';
import { initializeElasticsearchIndex } from './integrations/elasticsearch/client';
import { getMailerTransporter } from './integrations/ethereal/mailer';

async function startServer() {
  console.log('🚀 Starting ReachInbox Email Scheduler backend...');

  // 1. Initialize Ethereal SMTP transporter
  try {
    await getMailerTransporter();
  } catch (err: any) {
    console.warn('⚠️ SMTP Transporter notice:', err.message);
  }

  // 2. Initialize Elasticsearch index if reachable
  try {
    await initializeElasticsearchIndex();
  } catch (err: any) {
    console.warn('⚠️ Elasticsearch init notice:', err.message);
  }

  // 3. Start HTTP server
  const server = app.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(`✅ ReachInbox Backend running on port ${config.PORT}`);
    console.log(`📡 REST API:       ${config.BACKEND_URL}/api`);
    console.log(`📊 Bull Board UI:  ${config.BACKEND_URL}/admin/queues`);
    console.log(`⚡ Concurrency:    ${config.WORKER_CONCURRENCY}`);
    console.log(`⏱️ Min Delay:      ${config.MIN_EMAIL_DELAY_MS}ms`);
    console.log(`🚦 Rate Limit:     ${config.MAX_EMAILS_PER_HOUR}/hour`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`🛑 Received ${signal}. Gracefully shutting down...`);

    server.close(async () => {
      console.log('💤 HTTP server closed');
      try {
        await emailWorker.close();
        console.log('💤 BullMQ worker closed');
        await emailQueue.close();
        console.log('💤 BullMQ queue closed');
        await redisClient.quit();
        console.log('💤 Redis client disconnected');
        await prisma.$disconnect();
        console.log('💤 Prisma client disconnected');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('💥 Fatal error starting server:', err);
  process.exit(1);
});
