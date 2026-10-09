// Run from the repository root against the built API image:
// docker compose exec -T api node --input-type=module < apps/api/test/redis.security.mjs
// Each check uses an isolated UUID namespace and removes only its own keys.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { redisUrl } from './apps/api/dist/config.js';
import { consumeRate } from './apps/api/dist/abuse-limits.js';

const redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1 });
const unique = randomUUID();
const identity = label => createHash('sha256').update(`${unique}:${label}`).digest('hex');
const scope = `test-${unique}`;
const first = identity('one'), second = identity('two');
const keys = [`dofus:security:rate:${scope}:${first}`, `dofus:security:rate:${scope}:${second}`];
try {
  const attempts = await Promise.all(Array.from({length: 60}, () => consumeRate(redis, scope, first, 20)));
  assert.equal(attempts.filter(Boolean).length, 20);
  assert.equal(await consumeRate(redis, scope, second, 20), true);
  console.log(JSON.stringify({sharedRateAccepted: 20, secondClientUnaffected: true}, null, 2));
} finally {
  await redis.del(...keys);
  await redis.quit();
}
