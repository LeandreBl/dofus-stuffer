import type { IncomingMessage } from 'node:http';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { clientAddress, clientId, consumeRate } from './abuse-limits.js';

export function allowedOrigin(request: Pick<IncomingMessage, 'headers'>): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true; // Native clients still require capabilities and budgets.
  if (typeof origin !== 'string') return false;
  const configured = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000';
  return configured.split(',').map(value => value.trim()).includes(origin);
}

export const SOCKET_ADMISSION_SCRIPT = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= 10 or redis.call('ZCARD', KEYS[2]) >= 200 then return 0 end
for _, key in ipairs(KEYS) do
  redis.call('ZADD', key, now + 90000, ARGV[2])
  redis.call('PEXPIRE', key, 180000)
end
return 1
`;

export const SOCKET_RENEW_SCRIPT = `
if not redis.call('ZSCORE', KEYS[1], ARGV[2]) or not redis.call('ZSCORE', KEYS[2], ARGV[2]) then return 0 end
for _, key in ipairs(KEYS) do
  redis.call('ZADD', key, tonumber(ARGV[1]) + 90000, ARGV[2])
  redis.call('PEXPIRE', key, 180000)
end
return 1
`;

export interface SocketLease { identity: string; member: string; keys: [string, string] }

export async function admitSocket(redis: Pick<Redis, 'eval'>, request: IncomingMessage): Promise<SocketLease | null> {
  if (!allowedOrigin(request)) return null;
  const identity = clientId(clientAddress(request));
  if (!await consumeRate(redis, 'connections', identity, 30)) return null;
  const member = `${identity}:${randomUUID()}`;
  const keys: [string, string] = [`dofus:security:sockets:${identity}`, 'dofus:security:sockets:global'];
  const accepted = await redis.eval(SOCKET_ADMISSION_SCRIPT, 2, ...keys, Date.now(), member);
  return accepted === 1 ? { identity, member, keys } : null;
}

export async function renewSocket(redis: Pick<Redis, 'eval'>, lease: SocketLease): Promise<boolean> {
  return await redis.eval(SOCKET_RENEW_SCRIPT, 2, ...lease.keys, Date.now(), lease.member) === 1;
}

export async function releaseSocket(redis: Pick<Redis, 'multi'>, lease: SocketLease): Promise<void> {
  await redis.multi().zrem(lease.keys[0], lease.member).zrem(lease.keys[1], lease.member).exec();
}
