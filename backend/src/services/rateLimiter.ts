import redisClient from '../config/redis';
import config from '../config';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourKey: string;
  rescheduleDelayMs: number;
  nextWindowDate: Date;
}

/**
 * Returns formatted hour string: YYYY-MM-DD-HH (in UTC to avoid timezone drift across distributed workers)
 */
export function getHourKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

/**
 * Calculates start of the next hour in UTC and millisecond delay from now
 */
export function getNextHourWindow(now: Date = new Date()): { nextWindowDate: Date; delayMs: number } {
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  nextHour.setUTCMinutes(0, 0, 0); // start of next hour
  const delayMs = Math.max(1000, nextHour.getTime() - now.getTime());
  return { nextWindowDate: nextHour, delayMs };
}

/**
 * Lua script for atomic distributed rate check & increment:
 * 1. Read current count
 * 2. If count < limit, INCR and ensure TTL (2 hours)
 * 3. Return [allowed (1 or 0), current_count]
 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('get', key) or "0")

if current < limit then
  local next_val = redis.call('incr', key)
  local ttl = redis.call('ttl', key)
  if ttl < 0 then
    redis.call('expire', key, 7200)
  end
  return {1, next_val}
else
  return {0, current}
end
`;

export async function checkAndConsumeRateSlot(
  senderId: string,
  configuredLimit?: number,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const limit = configuredLimit && configuredLimit > 0 ? configuredLimit : config.MAX_EMAILS_PER_HOUR;
  const hourKey = getHourKey(now);
  const redisKey = `email-rate:${senderId}:${hourKey}`;

  const { nextWindowDate, delayMs } = getNextHourWindow(now);

  try {
    const res = (await redisClient.eval(RATE_LIMIT_LUA, 1, redisKey, limit.toString())) as [number, number];
    const allowed = res[0] === 1;
    const currentCount = res[1];

    return {
      allowed,
      currentCount,
      limit,
      hourKey,
      rescheduleDelayMs: delayMs,
      nextWindowDate,
    };
  } catch (err: any) {
    console.error(`❌ Redis rate limit check failed for sender ${senderId}:`, err.message);
    throw err;
  }
}
