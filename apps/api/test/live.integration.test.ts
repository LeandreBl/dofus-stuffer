import test from 'node:test';
import assert from 'node:assert/strict';
import type { Catalog } from '@dofus/shared';

// Searches run in the browser (shared engine, covered by optimizer.test.ts): the live API only serves data.
test('Live stack: catalog, maintenance and server prices are readable', {
  skip: !process.env.API_URL, timeout: 10_000,
}, async () => {
  const base = process.env.API_URL!.replace(/\/$/, '');
  const catalog = await fetch(`${base}/api/catalog`).then(response => response.json()) as Catalog;
  assert.match(catalog.revision || '', /^[a-f0-9]{64}$/);
  const report = await fetch(`${base}/api/maintenance`);
  assert.equal(report.status, 200);
  const maintenance = await report.json() as { running: boolean; cron: string; timezone: string };
  assert.equal(typeof maintenance.running, 'boolean');
  assert.ok(maintenance.cron && maintenance.timezone);
  const priceResponse = await fetch(`${base}/api/prices?server=${encodeURIComponent(catalog.servers[0])}`);
  assert.equal(priceResponse.status, 200);
  const prices = await priceResponse.json() as { server: string; values: Record<string, number>; status: string };
  assert.equal(prices.server, catalog.servers[0]);
  assert.ok(['available', 'unconfigured', 'unavailable'].includes(prices.status));
  assert.equal((await fetch(`${base}/api/prices?server=does-not-exist`)).status, 400);
});
