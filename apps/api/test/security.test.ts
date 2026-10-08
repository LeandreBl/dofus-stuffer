import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEnabled, bearerToken, hashToken, issueToken, validJobId, verifyAdmin, verifyToken } from '../src/security.js';
import { clientAddress, clientId, proxyTrust } from '../src/abuse-limits.js';
import { JobsGateway } from '../src/jobs.gateway.js';
import { allowedOrigin } from '../src/socket-security.js';
import { fetchLimited } from '../src/maintenance.js';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { redisUrl } from '../src/config.js';

test('Redis passwords from the environment preserve URL punctuation without entering Redis keys', () => {
  const previousUrl = process.env.REDIS_URL, previousPassword = process.env.REDIS_PASSWORD;
  process.env.REDIS_URL = 'redis://redis:6379';
  process.env.REDIS_PASSWORD = 'private:@/#?$ value';
  try {
    const url = new URL(redisUrl());
    assert.equal(url.hostname, 'redis');
    assert.equal(decodeURIComponent(url.password), process.env.REDIS_PASSWORD);
    assert.equal(url.pathname, '');
    assert.equal(url.search, '');
  } finally {
    if (previousUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previousUrl;
    if (previousPassword === undefined) delete process.env.REDIS_PASSWORD; else process.env.REDIS_PASSWORD = previousPassword;
  }
});

test('A job capability is unguessable and verified against a stored digest', () => {
  const first = issueToken();
  const second = issueToken();
  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.equal(verifyToken(first, hashToken(first)), true);
  assert.equal(verifyToken(second, hashToken(first)), false);
  assert.equal(verifyToken('x'.repeat(100_000), hashToken(first)), false);
  assert.equal(verifyToken(null, hashToken(first)), false);
  assert.equal(verifyToken(first, null), false);
});

test('Only UUID-v4 job identifiers can become Redis keys', () => {
  assert.equal(validJobId('bc805eac-cea5-46a9-b7f2-4950008a1b34'), true);
  assert.equal(validJobId('anything:*'), false);
  assert.equal(validJobId(undefined), false);
});

test('Only the configured proxy can supply a client address and the last hop wins', () => {
  const trusted = proxyTrust('172.30.240.2');
  const request = (peer: string, forwarded: string) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': forwarded } }) as any;
  assert.equal(clientAddress(request('::ffff:172.30.240.2', '203.0.113.99, 192.0.2.1'), trusted), '192.0.2.1');
  assert.equal(clientAddress(request('172.30.240.3', '192.0.2.1'), trusted), '172.30.240.3');
  assert.equal(clientAddress(request('172.30.240.2', 'invalid'), trusted), '172.30.240.2');
  assert.notEqual(clientId('192.0.2.1'), clientId('192.0.2.2'));
  assert.equal(clientId('2001:db8:1:2::1'), clientId('2001:db8:1:2::ffff'));
  assert.notEqual(clientId('2001:db8:1:2::1'), clientId('2001:db8:1:3::1'));
  assert.throws(() => proxyTrust('all'));
});

test('Bearer capabilities are parsed only from an unambiguous authorization header', () => {
  const token = issueToken();
  assert.equal(bearerToken(`Bearer ${token}`), token);
  for (const value of [undefined, ['Bearer', token], `Bearer ${token}, other`, `Basic ${token}`, 'Bearer invalid']) assert.equal(bearerToken(value), undefined);
});

test('Foreign and opaque browser origins are denied while native clients remain supported', () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://dofus-stuffer.notdotio.com';
  try {
    assert.equal(allowedOrigin({ headers: {} }), true);
    assert.equal(allowedOrigin({ headers: { origin: 'https://dofus-stuffer.notdotio.com' } }), true);
    assert.equal(allowedOrigin({ headers: { origin: 'https://audit.invalid' } }), false);
    assert.equal(allowedOrigin({ headers: { origin: 'null' } }), false);
    assert.equal(allowedOrigin({ headers: { origin: 'https://dofus-stuffer.notdotio.com.evil.invalid' } }), false);
  } finally { if (previous === undefined) delete process.env.ALLOWED_ORIGINS; else process.env.ALLOWED_ORIGINS = previous; }
});

const subscriptionGateway = (status: string, subscribe: () => Promise<unknown>) => {
  const subscriber = Object.assign(new EventEmitter(), { status, subscribe });
  const engine = Object.assign(new EventEmitter(), { opts: {} });
  const gateway = new JobsGateway({ subscriber } as any, {} as any);
  gateway.server = { engine } as any;
  return { gateway, subscriber };
};

test('Progress subscriptions wait for Redis readiness and retry after reconnection', async () => {
  let calls = 0;
  const { gateway, subscriber } = subscriptionGateway('connecting', async () => { calls += 1; });
  gateway.afterInit();
  assert.equal(calls, 0);
  subscriber.emit('ready');
  assert.equal(calls, 1);
  subscriber.emit('ready');
  assert.equal(calls, 2);
  await gateway.onModuleDestroy();
  assert.equal(subscriber.listenerCount('ready'), 0);
  assert.equal(subscriber.listenerCount('message'), 0);
});

test('Progress subscriptions start immediately when Redis is already ready', () => {
  let calls = 0;
  const { gateway } = subscriptionGateway('ready', async () => { calls += 1; });
  gateway.afterInit();
  assert.equal(calls, 1);
});

test('A rejected Redis subscription is caught without logging authentication credentials', async () => {
  const secret = 'synthetic-sensitive-password';
  let calls = 0;
  const { gateway, subscriber } = subscriptionGateway('ready', async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('WRONGPASS'), { command: { name: 'auth', args: [secret] } });
  });
  const warnings: string[] = [];
  (gateway as any).logger.warn = (message: string) => { warnings.push(message); };
  gateway.afterInit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes(secret), false);
  subscriber.emit('ready');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(warnings.length, 1);
});

test('Concurrent subscriptions cannot exceed five authorized rooms and failures free their reservations', async () => {
  const failedId = randomUUID();
  const jobs = {
    authorize: async () => { await new Promise(resolve => setTimeout(resolve, 5)); },
    read: async (id: string) => { if (id === failedId) throw new Error(); return { id }; },
  };
  const gateway = new JobsGateway({ client: { eval: async () => [1, 60000] } } as any, jobs as any);
  const socket = {
    connected: true, data: {}, request: { socket: { remoteAddress: '192.0.2.1' }, headers: {} },
    rooms: new Set(['client']), join: async (room: string) => { socket.rooms.add(room); },
    leave: async (room: string) => { socket.rooms.delete(room); }, emit: () => {},
  } as any;
  const failed = await gateway.subscribe(socket, { jobId: failedId, token: 'authorized' });
  assert.equal(failed.ok, false);
  assert.equal(socket.rooms.size, 1);
  const results = await Promise.all(Array.from({ length: 7 }, () => gateway.subscribe(socket, { jobId: randomUUID(), token: 'authorized' })));
  assert.equal(results.filter(value => value.ok).length, 5);
  assert.equal(socket.rooms.size, 6);
});

test('HTTP feeds and redirects that downgrade HTTPS are rejected before fetching them', async () => {
  const requested: string[] = [];
  const fetcher = (async (url: string) => { requested.push(url); return new Response(null, { status: 302, headers: { location: 'http://test.invalid/insecure' } }); }) as typeof fetch;
  await assert.rejects(fetchLimited('http://test.invalid', 1000, fetcher), /HTTPS/);
  assert.equal(requested.length, 0);
  await assert.rejects(fetchLimited('https://test.invalid/secure', 1000, fetcher), /HTTPS/);
  assert.deepEqual(requested, ['https://test.invalid/secure']);
});

test('Admin access stays closed without a long ADMIN_TOKEN and only accepts that exact bearer', () => {
  const previous = process.env.ADMIN_TOKEN;
  try {
    process.env.ADMIN_TOKEN = 'short';
    assert.equal(adminEnabled(), false);
    assert.equal(verifyAdmin('Bearer short'), false);
    process.env.ADMIN_TOKEN = 'a'.repeat(40);
    assert.equal(verifyAdmin(`Bearer ${'a'.repeat(40)}`), true);
    assert.equal(verifyAdmin(`Bearer ${'a'.repeat(39)}b`), false);
    assert.equal(verifyAdmin('a'.repeat(40)), false);
    assert.equal(verifyAdmin(undefined), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previous;
  }
});
