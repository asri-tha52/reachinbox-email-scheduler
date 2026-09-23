import Redis, { RedisOptions } from 'ioredis';
import config from './index';
// ioredis ships its own URL parser – use it so we never hand BullMQ a
// bare RedisOptions that omits host/port and causes it to silently default
// to 127.0.0.1:6379.
import { parseURL } from 'ioredis/built/utils';

/**
 * Parses config.REDIS_URL and returns a plain RedisOptions object with all
 * fields (host, port, username, password, db, tls) explicitly set.
 *
 * BullMQ's Worker / Queue MUST receive a RedisOptions that already contains
 * host + port.  If they receive an object without those fields they silently
 * fall back to { host: '127.0.0.1', port: 6379 } – which is the root cause
 * of the ECONNREFUSED 127.0.0.1:6379 errors in production.
 */
export function getBullMQConnectionOptions(): RedisOptions {
  const parsed = parseURL(config.REDIS_URL) as Record<string, string | number | undefined>;

  const opts: RedisOptions = {
    host: String(parsed.host || '127.0.0.1'),
    port: Number(parsed.port || 6379),
    // BullMQ requires maxRetriesPerRequest: null on blocking connections
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      return Math.min(times * 100, 3000);
    },
  };

  if (parsed.username) opts.username = String(parsed.username);
  if (parsed.password) opts.password = String(parsed.password);
  if (parsed.db !== undefined) opts.db = Number(parsed.db);

  // Enable TLS when the URL scheme is `rediss://`
  if (config.REDIS_URL.startsWith('rediss://')) {
    opts.tls = {};
  }

  return opts;
}

/**
 * @deprecated Use getBullMQConnectionOptions() when passing to BullMQ
 * Worker / Queue.  This export is kept only for the ioredis singleton
 * (createRedisClient) which already receives the URL as first argument.
 */
export const redisConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    return Math.min(times * 100, 3000);
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
