import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, issueToken, validJobId, verifyToken } from '../src/security.js';

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
