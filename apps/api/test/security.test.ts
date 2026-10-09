import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEnabled, verifyAdmin } from '../src/security.js';
import { clientAddress, clientId, proxyTrust } from '../src/abuse-limits.js';
import { fetchLimited } from '../src/maintenance.js';
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
