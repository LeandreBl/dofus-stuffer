import { createHash } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';
import type { Redis } from 'ioredis';
import { lookup } from 'node:dns/promises';

type ClientRequest = Pick<IncomingMessage, 'headers' | 'socket'>;
let resolvedProxies: string[] = [];
let currentTrust: ((address: string) => boolean) | undefined;

export async function refreshProxyHosts(): Promise<void> {
  const hosts = (process.env.TRUSTED_PROXY_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean);
  // Keep the last known proxies on failure: forgetting them would merge every visitor into the proxy's budget.
  try { resolvedProxies = (await Promise.all(hosts.map(host => lookup(host, { all: true })))).flat().map(entry => entry.address); }
  catch { throw new Error('Proxy de confiance introuvable sur le réseau Docker.'); }
  currentTrust = undefined;
}

/** Matcher built once per proxy refresh instead of once per request. */
export function trustedProxy(address: string): boolean {
  return (currentTrust ??= proxyTrust())(address);
}

export function normalizeAddress(value: string): string {
  const address = value.startsWith('::ffff:') ? value.slice(7) : value;
  if (isIP(address) === 6) return new URL(`http://[${address}]`).hostname.slice(1, -1);
  return isIP(address) === 4 ? address : 'unknown';
}

export function proxyTrust(addresses = [process.env.TRUSTED_PROXY_ADDRESSES || '', ...resolvedProxies].join(',')) {
  const trusted = new BlockList();
  for (const value of addresses.split(',').map(value => value.trim()).filter(Boolean)) {
    const address = normalizeAddress(value);
    if (address === 'unknown') throw new Error('Adresse de proxy de confiance invalide.');
    trusted.addAddress(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
  }
  return (value: string) => {
    const address = normalizeAddress(value);
    return address !== 'unknown' && trusted.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
  };
}

export function clientAddress(request: ClientRequest, trusted = trustedProxy): string {
  const peer = normalizeAddress(request.socket.remoteAddress || '');
  if (!trusted(peer)) return peer;
  const forwarded = request.headers['x-forwarded-for'];
  // The trusted edge appends the actual peer last. Never accept a client-supplied first entry.
  const value = typeof forwarded === 'string' ? forwarded.split(',').at(-1)?.trim() : undefined;
  return value && isIP(value) ? normalizeAddress(value) : peer;
}

export function clientId(address: string): string {
  const normalized = normalizeAddress(address);
  // IPv6 privacy addresses within one /64 share a budget, just as IPv4 NAT clients do.
  const group = isIP(normalized) === 6 ? new URL(`http://[${normalized}]`).hostname.slice(1, -1) : normalized;
  const identity = isIP(group) === 6 ? ipv6Prefix(group) : group;
  return createHash('sha256').update(identity).digest('hex');
}

function ipv6Prefix(address: string): string {
  const [left, right = ''] = address.split('::');
  const leading = left ? left.split(':') : [], trailing = right ? right.split(':') : [];
  const full = [...leading, ...Array(8 - leading.length - trailing.length).fill('0'), ...trailing];
  return full.slice(0, 4).map(value => Number.parseInt(value, 16).toString(16)).join(':');
}

export const RATE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local cost = tonumber(ARGV[1])
if current + cost > tonumber(ARGV[2]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
redis.call('INCRBY', KEYS[1], cost)
if current == 0 then redis.call('PEXPIRE', KEYS[1], ARGV[3]) end
return {1, redis.call('PTTL', KEYS[1])}
`;

const rateKey = (scope: string, identity: string) => `dofus:security:rate:${scope}:${identity}`;

export async function consumeRate(redis: Pick<Redis, 'eval'>, scope: string, identity: string,
  limit: number, windowMs = 60_000, cost = 1): Promise<boolean> {
  const result = await redis.eval(RATE_SCRIPT, 1, rateKey(scope, identity), cost, limit, windowMs) as [number, number];
  return result[0] === 1;
}

/** Gives back budget consumed by a request that was refused afterwards. */
export async function refundRate(redis: Pick<Redis, 'eval'>, scope: string, identity: string, cost: number): Promise<void> {
  // Only an existing window is refunded, so an expired key never comes back without a TTL.
  await redis.eval("if redis.call('EXISTS', KEYS[1]) == 1 then redis.call('DECRBY', KEYS[1], ARGV[1]) end return 1",
    1, rateKey(scope, identity), cost);
}
