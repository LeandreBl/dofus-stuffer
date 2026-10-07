import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import { MAX_QUEUED_JOBS, RETENTION_SECONDS } from './config.js';

export const ownerKey = (id: string) => `dofus:security:owner:${id}`;
export const activeClientKey = (identity: string) => `dofus:security:active:${identity}`;
export const reservationKey = (queue: Pick<Queue, 'toKey'>) => queue.toKey('security:reservations');

export const ADMISSION_SCRIPT = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[7], '-inf', now)
for _, id in ipairs(redis.call('ZRANGE', KEYS[7], 0, -1)) do
  local orphan = redis.call('EXISTS', ARGV[6] .. id) == 0 and not redis.call('ZSCORE', KEYS[1], id)
  local terminal = redis.call('ZSCORE', KEYS[9], id) or redis.call('ZSCORE', KEYS[10], id)
  if orphan or terminal then
    redis.call('ZREM', KEYS[7], id)
    redis.call('DEL', ARGV[7] .. id)
  end
end
local total = redis.call('LLEN', KEYS[2]) + redis.call('LLEN', KEYS[3])
  + redis.call('ZCARD', KEYS[4]) + redis.call('LLEN', KEYS[5])
  + redis.call('ZCARD', KEYS[6]) + redis.call('ZCARD', KEYS[1])
if total >= tonumber(ARGV[3]) then return 1 end
if redis.call('ZCARD', KEYS[7]) >= tonumber(ARGV[4]) then return 2 end
redis.call('ZADD', KEYS[1], now + 30000, ARGV[2])
redis.call('PEXPIRE', KEYS[1], 60000)
redis.call('ZADD', KEYS[7], now + tonumber(ARGV[5]), ARGV[2])
redis.call('PEXPIRE', KEYS[7], ARGV[5])
redis.call('SET', KEYS[8], ARGV[8], 'PX', ARGV[5])
return 0
`;

export const RELEASE_SCRIPT = `
local owner = redis.call('GET', KEYS[1])
if owner then
  redis.call('ZREM', ARGV[1] .. owner, ARGV[2])
  redis.call('DEL', KEYS[1])
end
return 1
`;

export async function reserveJob(redis: Pick<Redis, 'eval'>, queue: Pick<Queue, 'toKey'>,
  identity: string, id: string, now = Date.now()): Promise<number> {
  return await redis.eval(ADMISSION_SCRIPT, 10, reservationKey(queue),
    queue.toKey('wait'), queue.toKey('active'), queue.toKey('delayed'), queue.toKey('paused'), queue.toKey('prioritized'),
    activeClientKey(identity), ownerKey(id), queue.toKey('completed'), queue.toKey('failed'),
    now, id, MAX_QUEUED_JOBS, 3, RETENTION_SECONDS * 1000, queue.toKey(''), 'dofus:security:owner:', identity) as number;
}
