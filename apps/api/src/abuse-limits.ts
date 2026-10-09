import { createHash } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';
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

// ponytail: in-process fixed windows, fine for a single API container; a shared store is needed to scale out.
const windows = new Map<string, { used: number; resetAt: number }>();

export function consumeRate(scope: string, identity: string, limit: number, windowMs = 60_000, cost = 1, now = Date.now()): boolean {
  if (windows.size > 100_000) for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
  const key = `${scope}:${identity}`;
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) windows.set(key, entry = { used: 0, resetAt: now + windowMs });
  if (entry.used + cost > limit) return false;
  entry.used += cost;
  return true;
}
