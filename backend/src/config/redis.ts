import Redis, { RedisOptions } from 'ioredis';
import config from './index';

export const redisConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export function createRedisClient(): Redis {
  const client = new Redis(config.REDIS_URL, redisConnectionOptions);

  client.on('error', (err) => {
    // Log gracefully instead of crashing the process
    console.error('⚠️ [Redis Connection Error]:', err.message);
  });

  client.on('connect', () => {
    console.log('✅ Connected to Redis successfully');
  });

  return client;
}

export const redisClient = createRedisClient();

export default redisClient;
