import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../apps/web/src/equipment-locks.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { withEquipmentLocks } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const catalog = { items: [
  { id: 1, typeId: 16, category: 'equipment' },
  { id: 2, typeId: 9, category: 'equipment' },
  { id: 3, typeId: 23, category: 'dofus' },
] };
const request = () => ({
  character: { level: 200 }, constraints: [{ id: 'damage', kind: 'spell' }],
  filters: { lockedSlots: {}, excludedItemIds: [1, 3, 99], excludedTypeIds: [16, 9],
    excludedCategories: ['equipment', 'trophy'], allowedItemIds: [3], allowedExos: ['actionPoints'], maxExos: 1 },
  prices: { ownedItemIds: [1], values: { 1: 20_000 } },
});

test('Keeping equipment removes conflicting exclusions and adds it to an explicit allowed list', () => {
  const input = request();
  const before = structuredClone(input);
  const slots = { hat: 1, ring2: 2 };
  const result = withEquipmentLocks(input, catalog, slots);
  assert.deepEqual(result.filters.lockedSlots, slots);
  assert.deepEqual(result.filters.excludedItemIds, [3, 99]);
  assert.deepEqual(result.filters.excludedTypeIds, []);
  assert.deepEqual(result.filters.excludedCategories, ['trophy']);
  assert.deepEqual(result.filters.allowedItemIds, [3, 1, 2]);
  assert.deepEqual(input, before);
  assert.notEqual(result.filters.lockedSlots, slots);
  assert.equal(result.constraints, input.constraints);
  assert.equal(result.character, input.character);
  assert.equal(result.prices, input.prices);
  assert.deepEqual(result.filters.allowedExos, ['actionPoints']);
  assert.equal(result.filters.maxExos, 1);
});

test('Two copies of an ordinary ring are kept by slot without restricting other available equipment', () => {
  const input = request();
  delete input.filters.allowedItemIds;
  const result = withEquipmentLocks(input, catalog, { ring1: 2, ring2: 2 });
  assert.deepEqual(result.filters.lockedSlots, { ring1: 2, ring2: 2 });
  assert.equal(result.filters.allowedItemIds, undefined);
  assert.deepEqual(result.filters.excludedItemIds, input.filters.excludedItemIds);
  assert.deepEqual(result.filters.excludedTypeIds, [16]);
});

test('Unlocking or clearing the mannequin releases all slots while retaining unrelated settings', () => {
  const input = request();
  input.filters.lockedSlots = { hat: 1, dofus4: 3 };
  const result = withEquipmentLocks(input, catalog, {});
  assert.deepEqual(result.filters.lockedSlots, {});
  assert.deepEqual(result.filters.excludedItemIds, input.filters.excludedItemIds);
  assert.deepEqual(result.filters.allowedItemIds, input.filters.allowedItemIds);
  assert.equal(result.prices, input.prices);
  assert.deepEqual(input.filters.lockedSlots, { hat: 1, dofus4: 3 });
});
