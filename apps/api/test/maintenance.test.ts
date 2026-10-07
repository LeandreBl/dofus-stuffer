import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Catalog, OptimizationRequest } from '@dofus/shared';
import { atomicJson, catalogRevision, compareVersions } from '../src/maintenance-store.js';
import { DEFAULT_CRON, DEFAULT_TIMEZONE, parsePatchFeed, runMaintenance, type MaintenanceOptions } from '../src/maintenance.js';
import { validateCatalog, validatePrices } from '../src/maintenance-validation.js';
import { loadCatalog } from '../src/catalog.service.js';
import { validateRequest } from '../src/validation.js';
import { optimize } from '../src/optimizer.js';

const catalog: Catalog = { version: '3.7.4.4', fetchedAt: '2026-10-07T00:00:00.000Z', source: 'test',
  classes: [{ id: 1, name: 'Cra', icon: '' }], stats: [{ id: 10, key: 'strength', name: 'Force', category: 'Base' }],
  items: [{ id: 1, name: 'Chapeau', level: 1, typeId: 1, typeName: 'Coiffe', category: 'equipment', slotType: 'hat', stats: { strength: 10 }, icon: '' }], sets: [],
  spells: [{ id: 1, name: 'Flèche', description: '', classIds: [1], icon: '', levels: [{ id: 1, grade: 1, minPlayerLevel: 1, apCost: 3,
    minRange: 1, range: 6, rangeCanBeBoosted: true, criticalHitProbability: 5, maxCastPerTurn: 2, maxCastPerTarget: 2,
    minCastInterval: 0, effects: [{ effectId: 97, diceNum: 10, diceSide: 12, value: 0 }], criticalEffects: [] }] }], servers: ['Test'] };
const patch = '<rss><channel><item><title>DOFUS 3.7.5</title><link>https://www.dofus.com/fr/patch-375</link><pubDate>Wed, 07 Oct 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>Modification des objets.</p>]]></description></item></channel></rss>';
test('native passive metadata survives catalog validation while malformed combat effects are refused', () => {
  const candidate = structuredClone(catalog);
  candidate.items[0].passives = [{ id: 8395, name: 'Pourpre Profond', description: 'Bonus conditionnel',
    effects: [{ effectId: 1171, diceNum: 1, diceSide: 0, value: 0, duration: 2, targetMask: 'C' }] }];
  assert.deepEqual(validateCatalog(candidate).items[0].passives, candidate.items[0].passives);
  (candidate.items[0].passives[0].effects[0] as any).diceNum = '1';
  assert.throws(() => validateCatalog(candidate), /incomplet ou invalide/);
});
function fixture(responses: Record<string, unknown>) {
  const directory = mkdtempSync(join(tmpdir(), 'dofus-maintenance-'));
  const baselinePath = join(directory, 'baseline.json'); atomicJson(baselinePath, catalog);
  const options: MaintenanceOptions = { directory, baselinePath, catalogFeed: 'https://test.invalid/catalog', priceFeed: 'https://test.invalid/prices',
    patchFeed: 'https://test.invalid/patch', cron: DEFAULT_CRON, timezone: DEFAULT_TIMEZONE,
    fetcher: (async input => {
      const data = responses[String(input)];
      return data instanceof Error ? new Response('', { status: 503 }) : new Response(typeof data === 'string' ? data : JSON.stringify(data));
    }) as typeof fetch };
  return { directory, options, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}
test('weekly schedule defaults to Monday at 03:00 Paris and versions compare numerically', () => {
  assert.equal(DEFAULT_CRON, '0 3 * * 1'); assert.equal(DEFAULT_TIMEZONE, 'Europe/Paris');
  assert.equal(compareVersions('3.10.1', '3.7.4.4'), 1); assert.equal(compareVersions('3.7.4.4', '3.7.4.4'), 0);
  assert.throws(() => compareVersions('beta-latest', '3.7.4.4'));
});
test('feed rejects malformed catalogs, duplicate identifiers, unknown stats and invalid prices', () => {
  assert.throws(() => validateCatalog({ ...catalog, items: [{}] }));
  assert.throws(() => validateCatalog({ ...catalog, items: [...catalog.items, ...catalog.items] }));
  assert.throws(() => validateCatalog({ ...catalog, items: [{ ...catalog.items[0], stats: { invented: 900 } }] }));
  const feed = { updatedAt: '2026-10-07T00:00:00.000Z', servers: { Test: { values: { '1': 0 }, exoCosts: { actionPoints: 100 } } } };
  assert.equal(validatePrices(feed, catalog, Date.parse('2026-10-07')).servers.Test.values['1'], 0);
  assert.throws(() => validatePrices({ ...feed, servers: { Test: { values: { '999': 100 } } } }, catalog));
  assert.throws(() => validatePrices({ ...feed, servers: { Other: { values: { '1': 100 } } } }, catalog));
  assert.throws(() => validatePrices({ ...feed, servers: { Test: { values: { '1': -5 } } } }, catalog));
});
test('catalog downgrade is refused while independent price and patch refresh still succeed', async () => {
  const f = fixture({ 'https://test.invalid/catalog': { ...catalog, version: '3.6.12.16' },
    'https://test.invalid/prices': { updatedAt: new Date().toISOString(), servers: { Test: { values: { '1': 12345 } } } }, 'https://test.invalid/patch': patch });
  try {
    const status = await runMaintenance(f.options);
    assert.equal(status.catalog?.status, 'older'); assert.equal(status.catalogVersion, '3.7.4.4');
    assert.equal(status.prices?.status, 'updated'); assert.equal(status.patch?.status, 'updated'); assert.equal(status.latestPatch?.version, '3.7.5');
    assert.equal(JSON.parse(readFileSync(join(f.directory, 'prices.json'), 'utf8')).servers.Test.values['1'], 12345);
  } finally { f.cleanup(); }
});
test('same-version gameplay revision updates atomically and hotreload keeps captured snapshots stable', async () => {
  const candidate = structuredClone(catalog); candidate.items[0].stats.strength = 50;
  const f = fixture({ 'https://test.invalid/catalog': candidate, 'https://test.invalid/patch': patch });
  const oldPath = process.env.CATALOG_PATH, oldRuntime = process.env.DATA_RUNTIME_DIR;
  process.env.CATALOG_PATH = f.options.baselinePath; process.env.DATA_RUNTIME_DIR = f.directory;
  try {
    const before = loadCatalog(); assert.equal(before.items[0].stats.strength, 10);
    const status = await runMaintenance({ ...f.options, priceFeed: undefined });
    assert.equal(status.catalog?.status, 'updated'); assert.equal(status.prices?.status, 'unconfigured');
    const after = loadCatalog(); assert.equal(after.items[0].stats.strength, 50); assert.notEqual(after.revision, before.revision);
    assert.equal(before.items[0].stats.strength, 10); assert.equal(after, loadCatalog());
    const dated = { ...after, fetchedAt: '2026-10-08T00:00:00.000Z' };
    assert.equal(catalogRevision(dated), after.revision);
  } finally { if (oldPath === undefined) delete process.env.CATALOG_PATH; else process.env.CATALOG_PATH = oldPath;
    if (oldRuntime === undefined) delete process.env.DATA_RUNTIME_DIR; else process.env.DATA_RUNTIME_DIR = oldRuntime; f.cleanup(); }
});
test('failed and stale feeds preserve the last valid catalogue, prices and patch', async () => {
  const f = fixture({ 'https://test.invalid/catalog': { items: [] }, 'https://test.invalid/prices': new Error('offline'), 'https://test.invalid/patch': new Error('offline') });
  const existing = { servers: { Test: { values: { '1': 777 }, updatedAt: new Date().toISOString(), source: 'test' } } };
  atomicJson(join(f.directory, 'prices.json'), existing); atomicJson(join(f.directory, 'catalog.json'), catalog);
  atomicJson(join(f.directory, 'maintenance.json'), { latestPatch: { title: 'Previous', url: 'https://www.dofus.com/previous', excerpt: '' } });
  try {
    const status = await runMaintenance(f.options);
    assert.equal(status.catalog?.status, 'error'); assert.equal(status.prices?.status, 'error'); assert.equal(status.patch?.status, 'error');
    assert.equal(status.latestPatch?.title, 'Previous'); assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'prices.json'), 'utf8')), existing);
    assert.equal(JSON.parse(readFileSync(join(f.directory, 'catalog.json'), 'utf8')).items[0].stats.strength, 10);
  } finally { f.cleanup(); }
});
test('patch text is read-only, strips markup and disallows external XML entities', () => {
  const result = parsePatchFeed(patch, 'https://www.dofus.com'); assert.equal(result.excerpt, 'Modification des objets.');
  assert.throws(() => parsePatchFeed('<!DOCTYPE test [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + patch, 'https://www.dofus.com'));
  assert.throws(() => parsePatchFeed('<html>Login</html>', 'https://www.dofus.com'));
  assert.throws(() => parsePatchFeed(patch.replace('https://www.dofus.com/fr/patch-375', 'https://third-party.invalid/instruction'), 'https://www.dofus.com'));
});
test('automatic prices make strict budget searches feasible and explicit manual zero takes precedence', async () => {
  const request: OptimizationRequest = { character: { classId: 1, level: 1, baseStats: {} },
    constraints: [{ id: 'budget', kind: 'price', target: 150, relation: 'atMost', strict: true, priority: 0 }],
    filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: { hat: 1 }, allowedExos: ['actionPoints'], maxExos: 1 },
    prices: { server: 'Test', mode: 'total', values: {}, ownedItemIds: [], automaticValues: { '1': 100 }, automaticExoCosts: { actionPoints: 25 } },
    target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' }, seconds: 3, seed: 1 };
  const parsed = validateRequest(request, catalog);
  const result = await optimize(catalog, parsed, { onProgress: async () => false });
  assert.ok(result.results.length); assert.ok(result.results.every(r => r.cost !== null && r.cost <= 150));
  const free = await optimize(catalog, { ...request, prices: { ...request.prices, values: { '1': 0 }, exoCosts: { actionPoints: 0 } } }, { onProgress: async () => false });
  assert.ok(free.results.every(r => r.cost === 0));
  const revision = catalogRevision(catalog);
  assert.equal(validateRequest({ ...request, catalogRevision: revision }, { ...catalog, revision }).catalogRevision, revision);
  assert.throws(() => validateRequest({ ...request, catalogRevision: '0'.repeat(64) }, { ...catalog, revision }));
});

test('older price observation cannot replace newer prices', async () => {
  const f = fixture({ 'https://test.invalid/catalog': catalog, 'https://test.invalid/prices': {
    updatedAt: '2026-10-01T00:00:00.000Z', servers: { Test: { values: { '1': 5 } } } }, 'https://test.invalid/patch': patch });
  const existing = { servers: { Test: { values: { '1': 900 }, updatedAt: '2026-10-06T00:00:00.000Z', source: 'test' } } };
  atomicJson(join(f.directory, 'prices.json'), existing);
  try {
    const status = await runMaintenance(f.options);
    assert.equal(status.prices?.status, 'older');
    assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'prices.json'), 'utf8')), existing);
  } finally { f.cleanup(); }
});
test('corrupt runtime catalogue falls back to packaged data without blocking independent price refresh', async () => {
  const f = fixture({ 'https://test.invalid/catalog': catalog, 'https://test.invalid/prices': {
    updatedAt: new Date().toISOString(), servers: { Test: { values: { '1': 444 } } } }, 'https://test.invalid/patch': patch });
  atomicJson(join(f.directory, 'catalog.json'), { version: '3.7.99.99', items: 'corrupt' });
  const oldPath = process.env.CATALOG_PATH, oldRuntime = process.env.DATA_RUNTIME_DIR;
  process.env.CATALOG_PATH = f.options.baselinePath; process.env.DATA_RUNTIME_DIR = f.directory;
  try {
    assert.equal(loadCatalog().version, catalog.version);
    assert.equal(loadCatalog().items[0].stats.strength, 10);
    const status = await runMaintenance(f.options);
    assert.equal(status.catalog?.status, 'unchanged'); assert.equal(status.prices?.status, 'updated');
    assert.equal(JSON.parse(readFileSync(join(f.directory, 'prices.json'), 'utf8')).servers.Test.values['1'], 444);
  } finally { if (oldPath === undefined) delete process.env.CATALOG_PATH; else process.env.CATALOG_PATH = oldPath;
    if (oldRuntime === undefined) delete process.env.DATA_RUNTIME_DIR; else process.env.DATA_RUNTIME_DIR = oldRuntime; f.cleanup(); }
});
