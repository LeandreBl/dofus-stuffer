import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEnabled, verifyAdmin } from '../src/security.js';
import { clientAddress, clientId, consumeRate, proxyTrust } from '../src/abuse-limits.js';

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

test('Rate limits are per client and reset after their window', () => {
  const scope = `test-${Date.now()}`;
  const attempts = Array.from({ length: 30 }, () => consumeRate(scope, 'one', 20, 60_000, 1, 0));
  assert.equal(attempts.filter(Boolean).length, 20);
  assert.equal(consumeRate(scope, 'two', 20, 60_000, 1, 0), true);
  assert.equal(consumeRate(scope, 'one', 20, 60_000, 1, 60_000), true);
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
