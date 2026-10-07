// Run from the repository root against the built API image:
// docker compose exec -T api node --input-type=module < apps/api/test/redis.security.mjs
// Each check uses an isolated UUID namespace and removes only its own keys.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { redisUrl, snapshotKey, tokenKey } from './apps/api/dist/config.js';
import { consumeRate } from './apps/api/dist/abuse-limits.js';
import { activeClientKey, ownerKey, reservationKey, reserveJob } from './apps/api/dist/job-admission.js';
import { writeSnapshot } from './apps/api/dist/state.js';
import { JobsService } from './apps/api/dist/jobs.service.js';
import { SOCKET_ADMISSION_SCRIPT, SOCKET_RENEW_SCRIPT } from './apps/api/dist/socket-security.js';

const redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1 });
const unique = randomUUID();
const prefix = `dofus:security:test:${unique}:`;
const queue = { toKey: type => `${prefix}${type}` };
const keys = new Set(['wait','active','delayed','paused','prioritized','completed','failed','security:reservations'].map(type => queue.toKey(type)));
const identity = label => createHash('sha256').update(`${unique}:${label}`).digest('hex');
const trackJob = (client, id) => { keys.add(activeClientKey(client)); keys.add(ownerKey(id)); keys.add(snapshotKey(id)); keys.add(tokenKey(id)); };
try {
  const scope = `test-${unique}`;
  const first = identity('one'), second = identity('two');
  keys.add(`dofus:security:rate:${scope}:${first}`);
  keys.add(`dofus:security:rate:${scope}:${second}`);
  const attempts = await Promise.all(Array.from({length: 60}, () => consumeRate(redis, scope, first, 20)));
  assert.equal(attempts.filter(Boolean).length, 20);
  assert.equal(await consumeRate(redis, scope, second, 20), true);

  await redis.lpush(queue.toKey('wait'), ...Array.from({length: 99}, (_, index) => `existing-${index}`));
  const global = await Promise.all(Array.from({length: 20}, async (_, index) => {
    const client = identity(`global-${index}`), id = randomUUID(); trackJob(client, id);
    return reserveJob(redis, queue, client, id);
  }));
  assert.equal(global.filter(value => value === 0).length, 1);
  assert.equal(99 + await redis.zcard(reservationKey(queue)), 100);
  await redis.del(queue.toKey('wait'), reservationKey(queue));

  const client = identity('concurrent');
  const admitted = [];
  const clientResults = await Promise.all(Array.from({length: 8}, async () => {
    const id = randomUUID(); trackJob(client, id);
    const result = await reserveJob(redis, queue, client, id);
    if (result === 0) admitted.push(id);
    return result;
  }));
  assert.equal(clientResults.filter(value => value === 0).length, 3);
  for (const [index, id] of admitted.entries()) {
    const now = new Date().toISOString();
    await writeSnapshot(redis, { id, status: ['completed','failed','cancelled'][index], createdAt: now, updatedAt: now,
      progress: { percent: 100, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null }, results: [], catalogVersion: 'test' });
    assert.equal(await redis.exists(ownerKey(id)), 0);
  }
  assert.equal(await redis.zcard(activeClientKey(client)), 0);
  await redis.del(reservationKey(queue));

  const failedClient = identity('failed-add');
  let failedId;
  const service = Object.create(JobsService.prototype);
  service.redis = { client: redis };
  service.catalog = { data: {version: 'test'} };
  service.queue = { ...queue, getJob: async () => null, add: async (_name, _data, options) => {
    failedId = options.jobId; trackJob(failedClient, failedId); throw new Error('simulated queue failure');
  } };
  await assert.rejects(service.create({}, service.catalog.data, failedClient));
  assert.equal(await redis.zcard(activeClientKey(failedClient)), 0);
  assert.equal(await redis.exists(ownerKey(failedId)), 0);
  assert.equal(await redis.zcard(reservationKey(queue)), 0);

  const socketKeys = [`${prefix}socket-client`, `${prefix}socket-global`];
  socketKeys.forEach(key => keys.add(key));
  const sockets = await Promise.all(Array.from({length: 15}, (_, index) => redis.eval(SOCKET_ADMISSION_SCRIPT, 2, ...socketKeys, Date.now(), `socket-${index}`)));
  assert.equal(sockets.filter(value => value === 1).length, 10);
  assert.equal(await redis.zcard(socketKeys[1]), 10);
  await redis.zrem(socketKeys[0], 'socket-0');
  assert.equal(await redis.eval(SOCKET_RENEW_SCRIPT, 2, ...socketKeys, Date.now(), 'socket-0'), 0);
  assert.equal(await redis.zscore(socketKeys[0], 'socket-0'), null);
  await redis.del(...socketKeys);
  const globalSockets = await Promise.all(Array.from({length: 220}, (_, index) => {
    const key = `${prefix}socket-client-${index}`; keys.add(key);
    return redis.eval(SOCKET_ADMISSION_SCRIPT, 2, key, socketKeys[1], Date.now(), `global-socket-${index}`);
  }));
  assert.equal(globalSockets.filter(value => value === 1).length, 200);
  assert.equal(await redis.zcard(socketKeys[1]), 200);
  console.log(JSON.stringify({sharedRateAccepted: 20, secondClientUnaffected: true, globalQueueMaximum: 100,
    clientConcurrentMaximum: 3, releasedTerminalStates: 3, failedAddReleased: true, concurrentSocketsMaximum: 10,
    closedSocketNotRevived: true, globalSocketsMaximum: 200}, null, 2));
} finally {
  await redis.del(...keys);
  await redis.quit();
}
