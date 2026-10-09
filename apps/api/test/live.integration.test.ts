import test from 'node:test';
import assert from 'node:assert/strict';
import type { Catalog } from '@dofus/shared';

// Searches run in the browser (shared engine, covered by optimizer.test.ts): the live API only serves data.
test('Live stack: catalog and health are readable', {
  skip: !process.env.API_URL, timeout: 10_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  assert.match(catalog.revision || '', /^[a-f0-9]{64}$/);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});
