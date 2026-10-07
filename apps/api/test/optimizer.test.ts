import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTarget, type Catalog, type OptimizationRequest } from '@dofus/shared';
import { optimize, SearchConfigurationError } from '../src/optimizer.js';

function fixture(): Catalog {
  return {
    version: 'test-only', fetchedAt: '', source: 'automated-test-fixture',
    classes: [{ id: 9, name: 'Crâ', icon: '' }],
    stats: [{ id: 11, key: 'vitality', name: 'Vitalité', category: 'Base' }], spells: [],
    items: [
      { id: 1, name: 'Chapeau A', level: 1, typeId: 16, typeName: 'Chapeau', slotType: 'hat', category: 'equipment', stats: { vitality: 100 }, icon: '' },
      { id: 2, name: 'Chapeau B', level: 1, typeId: 16, typeName: 'Chapeau', slotType: 'hat', category: 'equipment', stats: { vitality: 10 }, setId: 77, icon: '' },
      { id: 3, name: 'Amulette A', level: 1, typeId: 1, typeName: 'Amulette', slotType: 'amulet', category: 'equipment', stats: { vitality: 100 }, icon: '' },
      { id: 4, name: 'Amulette B', level: 1, typeId: 1, typeName: 'Amulette', slotType: 'amulet', category: 'equipment', stats: { vitality: 10 }, setId: 77, icon: '' },
    ],
    sets: [{ id: 77, name: 'Panoplie test', bonuses: [{ count: 2, stats: { vitality: 300 } }] }],
    servers: ['test'],
  };
}
const request = (): OptimizationRequest => ({
  character: { classId: 9, level: 200, baseStats: {} },
  constraints: [{ id: 'vitality', kind: 'stat', statKey: 'vitality', target: 400, relation: 'maximize', priority: 0, strict: false }],
  target: defaultTarget(), filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
  prices: { server: 'test', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3, seed: 8,
});

test('Search sacrifices a small desired-stat gain to avoid a large malus on an unrequested stat', async () => {
  const catalog = fixture();
  catalog.sets = [];
  catalog.items = [
    { ...catalog.items[0], id: 1, stats: { strength: 500, tackleEvade: -150 } },
    { ...catalog.items[0], id: 2, stats: { strength: 490 } },
  ];
  const input = request();
  input.constraints = [{ id: 'str', kind: 'stat', statKey: 'strength', target: 1000, relation: 'maximize', priority: 0, strict: false }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results[0].build.slots.hat, 2);
  assert.equal(result.results[0].stats.strength, 490);
  assert.deepEqual(result.results[0].maluses.stats, {});
  assert.ok(result.progress.bestScore! > 0);
});

test('Search keeps required stats and allows a useful piece with a tiny malus', async () => {
  const catalog = fixture();
  catalog.sets = [];
  catalog.items = [
    { ...catalog.items[0], id: 1, stats: { strength: 500, tackleEvade: -150 } },
    { ...catalog.items[0], id: 2, stats: { strength: 490 } },
    { ...catalog.items[0], id: 3, stats: { strength: 500, agility: -1 } },
  ];
  const input = request();
  input.constraints = [{ id: 'str', kind: 'stat', statKey: 'strength', target: 500, relation: 'atLeast', priority: 0, strict: true }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results[0].build.slots.hat, 3);
  assert.ok(result.results.every(value => value.valid && value.constraints[0].satisfied));
  assert.equal(result.results[0].maluses.penalty, 0.025);
});

function criticalSpellCatalog(): Catalog {
  const catalog = fixture();
  catalog.spells = [{ id: 42, name: 'Flamme de test', description: '', classIds: [9], icon: '', levels: [{
    id: 42, grade: 1, minPlayerLevel: 1, apCost: 3, minRange: 1, range: 6, rangeCanBeBoosted: true,
    criticalHitProbability: 15, maxCastPerTurn: 2, maxCastPerTarget: 2, minCastInterval: 0,
    effects: [{ effectId: 99, diceNum: 30, diceSide: 30, value: 0 }],
    criticalEffects: [{ effectId: 99, diceNum: 40, diceSide: 40, value: 0 }],
  }] }];
  catalog.sets = [];
  return catalog;
}

test('An elemental objective with power ranks power equipment, while the same plain objective prefers actual stats', async () => {
  const catalog = fixture();
  catalog.sets = [];
  catalog.items = [
    { ...catalog.items[0], id: 1, stats: { strength: 100 } },
    { ...catalog.items[0], id: 2, stats: { damagePercent: 250 } },
  ];
  const input = request();
  input.constraints = [{ id: 'str', kind: 'stat', statKey: 'strength', includePower: true,
    target: 500, relation: 'maximize', priority: 0, strict: false }];
  const combined = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(combined.results[0].build.slots.hat, 2);
  assert.equal(combined.results[0].constraints[0].value, 250);
  assert.equal(combined.results[0].stats.strength || 0, 0);
  input.constraints[0].includePower = false;
  const plain = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(plain.results[0].build.slots.hat, 1);
  assert.equal(plain.results[0].constraints[0].value, 100);
});

test('Automatic allocation subtracts existing power from required elemental targets but never from item prerequisites', async () => {
  const catalog = fixture();
  catalog.sets = [];
  catalog.items = [{ ...catalog.items[0], stats: { damagePercent: 250 } }];
  const input = request();
  input.character = { classId: 9, level: 61, allocationMode: 'automatic', baseStats: {}, scrollStats: { strength: 100 } };
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [
    { id: 'wis', kind: 'stat', statKey: 'wisdom', target: 1, relation: 'maximize', priority: 0, strict: false },
    { id: 'str', kind: 'stat', statKey: 'strength', includePower: true, target: 500, relation: 'atLeast', priority: 1, strict: true },
  ];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.ok(result.results.length > 0);
  assert.equal(result.results[0].build.baseStats?.strength, 150);
  assert.equal(result.results[0].stats.strength, 250);
  assert.equal(result.results[0].constraints[1].value, 500);
  assert.equal(result.results[0].characterPoints.spent, 300);
  catalog.items[0].conditions = { kind: 'stat', stat: 'strength', operator: '>=', value: 301 };
  const impossible = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(impossible.results.length, 0, '301 real strength needs 303 points with these scrolls, above the level budget.');
});

test('A spell chance threshold and a damage threshold both hold on the same optimized build', async () => {
  const catalog = criticalSpellCatalog();
  const base = catalog.items[0];
  catalog.items = [
    { ...base, id: 1, stats: { criticalHit: 25 } },
    { ...base, id: 2, stats: { criticalDamageBonus: 100 } },
    { ...base, id: 3, slotType: 'boots', stats: { intelligence: 100 } },
    { ...base, id: 4, slotType: 'boots', stats: { vitality: 100 } },
  ];
  const input = request();
  input.character.baseStats = { intelligence: 100 };
  input.constraints = [
    { id: 'spell-chance', kind: 'spell', spellId: 42, metric: 'criticalChance', target: 40, relation: 'atLeast', priority: 0, strict: true },
    { id: 'spell-damage', kind: 'spell', spellId: 42, metric: 'min', mode: 'critical', target: 120, relation: 'atLeast', priority: 0, strict: true },
  ];
  const result = await optimize(catalog, input, { onProgress: async update => update.results.length > 0 });
  assert.ok(result.results.length > 0);
  for (const value of result.results) {
    assert.deepEqual(value.build.slots, { hat: 1, boots: 3 });
    assert.equal(value.constraints.find(constraint => constraint.id === 'spell-chance')?.value, 40);
    assert.equal(value.constraints.find(constraint => constraint.id === 'spell-damage')?.value, 120);
    assert.ok(value.constraints.every(constraint => constraint.satisfied && constraint.supported));
  }
});

test('Chance-only searches prioritize critical hit bonuses over many damage decoys and avoid elemental point allocation', async () => {
  const catalog = criticalSpellCatalog();
  const base = catalog.items[0];
  catalog.items = [
    ...Array.from({ length: 200 }, (_, index) => ({ ...base, id: index + 10,
      stats: { intelligence: 1_000, criticalDamageBonus: 1_000 } })),
    { ...base, id: 1, stats: { criticalHit: 35 } },
  ];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.constraints = [{ id: 'chance', kind: 'spell', spellId: 42, metric: 'criticalChance', target: 50,
    relation: 'atLeast', priority: 0, strict: true }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.ok(result.results.length > 0);
  assert.equal(result.results[0].build.slots.hat, 1);
  assert.equal(result.results[0].constraints[0].value, 50);
  assert.equal(result.results[0].build.baseStats?.intelligence || 0, 0);
  assert.equal(result.results[0].build.baseStats?.vitality, 995);
});

test('Minimizing a spell chance favors lower critical hit bonuses despite higher damage bonuses', async () => {
  const catalog = criticalSpellCatalog();
  const base = catalog.items[0];
  catalog.items = [
    ...Array.from({ length: 200 }, (_, index) => ({ ...base, id: index + 10,
      stats: { criticalHit: 35, intelligence: 1_000, criticalDamageBonus: 1_000 } })),
    { ...base, id: 1, stats: { criticalHit: -10 } },
  ];
  const input = request();
  input.constraints = [{ id: 'chance', kind: 'spell', spellId: 42, metric: 'criticalChance', target: 5,
    relation: 'minimize', priority: 0, strict: false }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results[0].build.slots.hat, 1);
  assert.equal(result.results[0].constraints[0].value, 5);
});

test('Search crosses a one-piece local maximum to find a better complete set', async () => {
  const result = await optimize(fixture(), request(), { onProgress: async update => update.results.some(build => build.stats.vitality === 320) });
  assert.equal(result.results[0].stats.vitality, 320);
  assert.equal(result.results[0].valid, true);
  assert.ok(result.progress.evaluated >= 2);
  assert.equal(result.cancelled, true);
});

test('No result is returned when a strict threshold is unmet; cancellation keeps actual counts', async () => {
  const input = request();
  input.constraints[0] = { ...input.constraints[0], relation: 'atLeast', target: 100_000, strict: true };
  const result = await optimize(fixture(), input, { onProgress: async () => true });
  assert.equal(result.results.length, 0);
  assert.equal(result.progress.feasible, 0);
  assert.ok(result.progress.evaluated > 0);
  assert.equal(result.stopReason, 'cancelled');
});

test('Locked slots and exclusions are respected in every returned build', async () => {
  const input = request();
  input.filters.lockedSlots.hat = 1;
  input.filters.excludedItemIds = [4];
  const result = await optimize(fixture(), input, { onProgress: async () => false });
  assert.equal(result.stopReason, 'fixed');
  assert.equal(result.results[0].build.slots.hat, 1);
  assert.equal(result.results[0].build.slots.amulet, 3);
  assert.equal(result.results[0].cost, null);
});

test('A reroll keeps its locked base despite a conflicting initial build and improves only unlocked pieces', async () => {
  const input = request();
  input.filters.lockedSlots = { hat: 2 };
  input.initialBuild = { slots: { hat: 1, amulet: 3 } };
  let sawUpdate = false;
  const result = await optimize(fixture(), input, { onProgress: async (update) => {
    sawUpdate = true;
    assert.ok(update.results.every((candidate) => candidate.build.slots.hat === 2));
    return update.results.some((candidate) => candidate.build.slots.amulet === 4);
  } });
  assert.ok(sawUpdate);
  assert.ok(result.results.length > 0);
  assert.ok(result.results.every((candidate) => candidate.build.slots.hat === 2));
  assert.equal(result.results[0].build.slots.amulet, 4);
  assert.equal(result.results[0].stats.vitality, 320);
  assert.deepEqual(input.filters.lockedSlots, { hat: 2 });
  assert.deepEqual(input.initialBuild.slots, { hat: 1, amulet: 3 });
});

test('A reroll preserves the exact locked ring and Dofus slots during search', async () => {
  const catalog = fixture();
  catalog.items.push(
    { ...catalog.items[0], id: 5, slotType: 'ring', stats: { vitality: 5 } },
    { ...catalog.items[0], id: 6, slotType: 'ring', stats: { vitality: 50 } },
    { ...catalog.items[0], id: 7, slotType: 'dofus', stats: { vitality: 1 } },
    { ...catalog.items[0], id: 8, slotType: 'dofus', stats: { vitality: 100 } },
  );
  const input = request();
  input.filters.lockedSlots = { ring2: 5, dofus4: 7 };
  input.initialBuild = { slots: { ring2: 6, dofus4: 8 } };
  const result = await optimize(catalog, input, { onProgress: async (update) => {
    assert.ok(update.results.every((candidate) => candidate.build.slots.ring2 === 5 && candidate.build.slots.dofus4 === 7));
    return update.progress.elapsedMs >= 350;
  } });
  assert.ok(result.results.length > 0);
  assert.ok(result.results.every((candidate) => candidate.build.slots.ring2 === 5 && candidate.build.slots.dofus4 === 7));
  assert.equal(result.results[0].build.slots.ring1, 6);
});

test('A locked base that makes a strict objective impossible produces no replacement result', async () => {
  const catalog = fixture();
  catalog.sets = [];
  const input = request();
  input.filters.lockedSlots = { hat: 2 };
  input.constraints[0] = { ...input.constraints[0], relation: 'atLeast', target: 150, strict: true };
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results.length, 0);
  assert.equal(result.progress.feasible, 0);
});

test('An obligatory budget cannot replace unknown prices by zero or naked slots', async () => {
  const input = request();
  input.constraints.push({ id: 'price', kind: 'price', target: 1_000, relation: 'atMost', priority: 1, strict: true });
  await assert.rejects(optimize(fixture(), input, { onProgress: async () => false }), SearchConfigurationError);
});

test('An excluded locked item fails explicitly instead of silently changing equipment', async () => {
  const input = request();
  input.filters.lockedSlots.hat = 1;
  input.filters.excludedItemIds = [1];
  await assert.rejects(optimize(fixture(), input, { onProgress: async () => false }), SearchConfigurationError);
});

test('Two ordinary rings can be equipped by the search', async () => {
  const catalog = fixture();
  catalog.items = [{ ...catalog.items[0], slotType: 'ring', setId: undefined }];
  const result = await optimize(catalog, request(), { onProgress: async () => false });
  assert.equal(result.results[0].build.slots.ring1, 1);
  assert.equal(result.results[0].build.slots.ring2, 1);
  assert.equal(result.results[0].stats.vitality, 200);
});

test('Alternative results never repeat the same equipment in permuted Dofus slots', async () => {
  const catalog = fixture();
  catalog.items.push(
    { ...catalog.items[0], id: 5, slotType: 'dofus', stats: { vitality: 20 } },
    { ...catalog.items[0], id: 6, slotType: 'dofus', stats: { vitality: 40 } },
  );
  const result = await optimize(catalog, request(), { onProgress: async update => update.progress.evaluated > 50 });
  const signatures = result.results.map(build => Object.values(build.build.slots).sort((a, b) => a! - b!).join('.'));
  assert.ok(signatures.length > 1);
  assert.equal(new Set(signatures).size, signatures.length);
});

test('A global PA bonus satisfies a threshold without changing or assigning the locked item', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
    { id: 'budget', kind: 'price', target: 1_000, relation: 'atMost', priority: 1, strict: true },
  ];
  input.prices.values = { '1': 100 };
  input.prices.exoCosts = { actionPoints: 500 };
  const result = await optimize(catalog, input, { onProgress: async () => false });
  assert.ok(result.results.length > 0);
  assert.deepEqual(result.results[0].build.exoBonuses, ['actionPoints']);
  assert.deepEqual(result.results[0].build.slots, { hat: 1 });
  assert.equal('exos' in result.results[0].build, false);
  assert.equal(result.results[0].stats.actionPoints, 8);
  assert.equal(result.results[0].cost, 600);
  assert.equal(result.stopReason, 'fixed');
});

test('An unknown exo surcharge cannot use normal item possession to pass a strict budget', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
    { id: 'budget', kind: 'price', target: 1_000, relation: 'atMost', priority: 1, strict: true },
  ];
  input.prices.values = { '1': 10 };
  input.prices.mode = 'remaining';
  input.prices.ownedItemIds = [1];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results.length, 0);
  input.prices.exoCosts = { actionPoints: 2_000 };
  const expensive = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(expensive.results.length, 0);
  input.prices.ownedExos = ['actionPoints'];
  const alreadyOwned = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(alreadyOwned.results[0].cost, 0);
  input.prices.mode = 'total';
  const totalPrice = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(totalPrice.results.length, 0, 'An already owned exo still has its market cost in total-price mode.');
});

test('The search enumerates global PA/PM bonuses with fixed gear and honors disabled bonuses', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0], catalog.items[2]];
  const input = request();
  input.filters.lockedSlots = { hat: 1, amulet: 3 };
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
    { id: 'pm', kind: 'stat', statKey: 'movementPoints', target: 4, relation: 'atLeast', priority: 0, strict: true },
  ];
  const result = await optimize(catalog, input, { onProgress: async () => false });
  assert.ok(result.results.length > 0);
  for (const value of result.results) {
    assert.equal(value.stats.actionPoints, 8);
    assert.equal(value.stats.movementPoints, 4);
    assert.deepEqual(value.build.exoBonuses, ['actionPoints', 'movementPoints']);
    assert.deepEqual(value.build.slots, { hat: 1, amulet: 3 });
  }
  assert.equal(result.progress.evaluated, 4, 'Every global combination is evaluated even when all items are fixed.');
  input.filters.maxExos = 1;
  const capped = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(capped.progress.evaluated, 3);
  assert.equal(capped.results.length, 0, 'Two mandatory bonuses cannot fit under a one-exo ceiling.');
  input.filters.maxExos = 2;
  const both = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(both.results.length, 1);
  assert.deepEqual(both.results[0].build.exoBonuses, ['actionPoints', 'movementPoints']);
  input.filters.allowedExos = [];
  const locked = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(locked.stopReason, 'fixed');
  assert.equal(locked.results.length, 0);
});

test('Zero, one and two exo ceilings enumerate only permitted combinations and allow fewer bonuses', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.filters.lockedSlots = { hat: 1 };
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  for (const [maxExos, expected] of [[0, ['']], [1, ['', 'actionPoints', 'movementPoints']],
    [2, ['', 'actionPoints', 'movementPoints', 'actionPoints,movementPoints']]] as const) {
    input.filters.maxExos = maxExos;
    const result = await optimize(catalog, input, { onProgress: async () => false });
    assert.equal(result.stopReason, 'fixed');
    assert.equal(result.progress.evaluated, expected.length);
    assert.deepEqual(new Set(result.results.map(value => value.build.exoBonuses?.join() || '')), new Set(expected));
    assert.ok(result.results.every(value => value.valid && (value.build.exoBonuses?.length || 0) <= maxExos));
    assert.ok(result.results.every(value => value.build.slots.hat === 1));
  }
});

test('With one exo allowed, ranked priorities choose PA or PM without changing the locked equipment', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.filters.lockedSlots = { hat: 1 };
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.filters.maxExos = 1;
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: false },
    { id: 'pm', kind: 'stat', statKey: 'movementPoints', target: 6, relation: 'atLeast', priority: 1, strict: false },
  ];
  input.prices.values = { '1': 100 };
  input.prices.exoCosts = { actionPoints: 500, movementPoints: 300 };
  const pa = await optimize(catalog, input, { onProgress: async () => false });
  assert.deepEqual(pa.results[0].build.exoBonuses, ['actionPoints']);
  assert.equal(pa.results[0].cost, 600);
  input.constraints[0].priority = 1;
  input.constraints[1].priority = 0;
  const pm = await optimize(catalog, input, { onProgress: async () => false });
  assert.deepEqual(pm.results[0].build.exoBonuses, ['movementPoints']);
  assert.equal(pm.results[0].cost, 400);
  assert.ok([...pa.results, ...pm.results].every(value => value.build.slots.hat === 1 && (value.build.exoBonuses?.length || 0) <= 1));
});

test('The cache and alternatives distinguish global bonuses without slot permutations', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  const result = await optimize(catalog, input, { onProgress: async update => update.progress.evaluated >= 2 });
  assert.equal(result.progress.evaluated, 2);
  assert.equal(result.results.length, 2);
  assert.deepEqual(new Set(result.results.map(value => value.build.exoBonuses?.join() || 'none')), new Set(['none', 'actionPoints']));
});

test('Global bonuses count toward item prerequisites before ranking valid candidates', async () => {
  const catalog = fixture();
  catalog.items = [{ ...catalog.items[0], forgeable: false,
    conditions: { kind: 'stat', stat: 'actionPoints', operator: '>=', value: 8 } }];
  const input = request();
  input.filters.lockedSlots = { hat: 1 };
  input.filters.allowedExos = ['actionPoints'];
  const result = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0].build.exoBonuses, ['actionPoints']);
  assert.equal(result.results[0].stats.actionPoints, 8);
  assert.equal(result.results[0].valid, true);
  assert.equal(result.results[0].cost, null, 'An unspecified global surcharge remains unknown outside a strict budget.');
  assert.deepEqual(result.results[0].missingExoPrices, ['pa']);
});

test('A 3.7 trophy prerequisite is enforced while searching between competing complete sets', async () => {
  const catalog = fixture();
  const base = catalog.items[0];
  catalog.items = [
    { ...base, id: 1, slotType: 'hat', setId: 10, stats: { strength: 100 } },
    { ...base, id: 2, slotType: 'amulet', setId: 10, stats: { strength: 100 } },
    { ...base, id: 3, slotType: 'ring', setId: 20, stats: { strength: 100 } },
    { ...base, id: 4, slotType: 'cape', setId: 20, stats: { strength: 100 } },
    { ...base, id: 5, slotType: 'hat', stats: { strength: 10 } },
    { ...base, id: 6, slotType: 'amulet', stats: { strength: 10 } },
    { ...base, id: 7, slotType: 'ring', stats: { strength: 10 } },
    { ...base, id: 8, slotType: 'cape', stats: { strength: 10 } },
    { ...base, id: 9, name: 'Trophée de test', slotType: 'dofus', stats: { actionPoints: 1 },
      conditions: { kind: 'stat', stat: 'activeSetCount', operator: '<', value: 2 } },
  ];
  catalog.sets = [
    { id: 10, name: 'A', bonuses: [{ count: 2, stats: { strength: 20 } }] },
    { id: 20, name: 'B', bonuses: [{ count: 2, stats: { strength: 20 } }] },
  ];
  const input = request();
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
    { id: 'str', kind: 'stat', statKey: 'strength', target: 400, relation: 'maximize', priority: 1, strict: false },
  ];
  const result = await optimize(catalog, input, { onProgress: async update => update.results.length > 0 });
  assert.ok(result.results.length > 0);
  assert.ok(result.progress.evaluated > 1, 'The greedy double-set seed must be repaired.');
  for (const value of result.results) {
    assert.equal(value.valid, true);
    assert.equal(value.stats.actionPoints, 8);
    assert.ok(value.stats.activeSetCount < 2);
    assert.ok(Object.values(value.build.slots).includes(9));
  }
});

test('The global exo surcharge never replaces missing or known normal equipment prices', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0], catalog.items[2]];
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.filters.lockedSlots = { hat: 1, amulet: 3 };
  input.prices.exoCosts = { actionPoints: 400 };
  input.constraints = [
    { id: 'pa', kind: 'stat', statKey: 'actionPoints', target: 8, relation: 'atLeast', priority: 0, strict: true },
    { id: 'budget', kind: 'price', target: 1_000, relation: 'atMost', priority: 1, strict: true },
  ];
  await assert.rejects(optimize(catalog, input, { onProgress: async () => false }), SearchConfigurationError);
  input.prices.values = { '1': 200, '3': 300 };
  const result = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(result.stopReason, 'fixed');
  assert.ok(result.results.length > 0);
  assert.deepEqual(result.results[0].build.exoBonuses, ['actionPoints']);
  assert.equal(result.results[0].stats.actionPoints, 8);
  assert.equal(result.results[0].cost, 900);
  input.constraints[1].target = 800;
  const overBudget = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(overBudget.results.length, 0);
});

test('Automatic allocation uses real tier costs and searches allocations even with all equipment locked', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.character.scrollStats = { strength: 100 };
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [{ id: 'str', kind: 'stat', statKey: 'strength', target: 500, relation: 'maximize', priority: 0, strict: false }];
  input.initialBuild = { slots: { hat: 1 }, baseStats: { vitality: 995 } };
  const result = await optimize(catalog, input, { onProgress: async update => update.progress.evaluated > 1 });
  assert.ok(result.progress.evaluated > 1);
  assert.equal(result.results[0].build.baseStats?.strength, 398);
  assert.equal(result.results[0].build.baseStats?.vitality, 3);
  assert.equal(result.results[0].stats.strength, 498);
  assert.equal(result.results[0].characterPoints.spent, 995);
  assert.equal(result.results.length, 1, 'Alternative allocations of one equipment set should not duplicate the results.');
});

test('Automatic allocation follows the equipped weapon element including neutral damage', async () => {
  for (const [effectId, statKey] of [[96, 'chance'], [100, 'strength']] as const) {
    const catalog = fixture();
    catalog.items = [{ ...catalog.items[0], slotType: 'weapon', stats: {},
      effects: [{ effectId, diceNum: 30, diceSide: 30, value: 0 }],
      weapon: { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 } }];
    const input = request();
    input.character.allocationMode = 'automatic';
    input.filters.lockedSlots = { weapon: 1 };
    input.constraints = [{ id: 'weapon', kind: 'weapon', mode: 'normal', metric: 'average', target: 500, relation: 'maximize', priority: 0, strict: false }];
    const result = await optimize(catalog, input, { onProgress: async () => true });
    assert.ok(result.results.length > 0);
    assert.equal(result.results[0].build.baseStats?.[statKey], 398);
    assert.equal(result.results[0].constraints[0].value, 149);
    assert.equal(result.results[0].characterPoints.spent, 995);
  }
});

test('Changing weapon reallocates base stats to its new element before ranking the candidate', async () => {
  const catalog = fixture();
  const base = catalog.items[0];
  const weapon = { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 };
  catalog.items = [
    { ...base, id: 1, slotType: 'weapon', stats: {}, weapon, effects: [{ effectId: 96, diceNum: 50, diceSide: 50, value: 0 }] },
    { ...base, id: 2, slotType: 'weapon', stats: {}, weapon, effects: [{ effectId: 99, diceNum: 40, diceSide: 40, value: 0 }] },
    { ...base, id: 3, slotType: 'hat', stats: { intelligence: 500 } },
  ];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.filters.lockedSlots = { hat: 3 };
  input.constraints = [{ id: 'weapon', kind: 'weapon', mode: 'normal', metric: 'average', target: 500, relation: 'maximize', priority: 0, strict: false }];
  const result = await optimize(catalog, input, { onProgress: async update => update.results[0]?.build.slots.weapon === 2 });
  assert.equal(result.results[0].build.slots.weapon, 2);
  assert.equal(result.results[0].build.baseStats?.intelligence, 398);
  assert.equal(result.results[0].build.baseStats?.chance || 0, 0);
  assert.equal(result.results[0].constraints[0].value, 399);
});

test('Weapon damage and critical chance guide the same search independently', async () => {
  const catalog = fixture();
  const base = catalog.items[0];
  const weapon = { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 30, criticalHitBonus: 5, maxCastPerTurn: 1 };
  catalog.items = [
    { ...base, id: 1, slotType: 'weapon', stats: {}, weapon, effects: [{ effectId: 97, diceNum: 50, diceSide: 50, value: 0 }] },
    { ...base, id: 2, slotType: 'weapon', stats: {}, weapon: { ...weapon, criticalHitProbability: 10 }, effects: [{ effectId: 97, diceNum: 200, diceSide: 200, value: 0 }] },
    { ...base, id: 3, slotType: 'hat', stats: { criticalHit: 40 } },
  ];
  const input = request();
  input.constraints = [
    { id: 'damage', kind: 'weapon', mode: 'critical', metric: 'min', target: 50, relation: 'atLeast', priority: 0, strict: true },
    { id: 'chance', kind: 'weapon', metric: 'criticalChance', target: 70, relation: 'atLeast', priority: 0, strict: true },
  ];
  const result = await optimize(catalog, input, { onProgress: async update => update.results.length > 0 });
  assert.ok(result.results.length > 0);
  assert.equal(result.results[0].build.slots.weapon, 1);
  assert.deepEqual(result.results[0].constraints.map(criterion => criterion.value), [55, 70]);
});

test('Automatic allocation follows the damage element of a selected spell instead of the class name', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  catalog.spells = [{ id: 42, name: 'Feu de test', description: '', classIds: [9], icon: '', levels: [{
    id: 42, grade: 1, minPlayerLevel: 1, apCost: 3, minRange: 1, range: 6, rangeCanBeBoosted: true,
    criticalHitProbability: 0, maxCastPerTurn: 2, maxCastPerTarget: 2, minCastInterval: 0,
    effects: [{ effectId: 99, diceNum: 30, diceSide: 30, value: 0 }], criticalEffects: [],
  }] }];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.character.scrollStats = { intelligence: 100 };
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [{ id: 'spell', kind: 'spell', spellId: 42, mode: 'normal', metric: 'average', target: 500, relation: 'maximize', priority: 0, strict: false }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results[0].build.baseStats?.intelligence, 398);
  assert.equal(result.results[0].build.baseStats?.strength || 0, 0);
  assert.equal(result.results[0].constraints[0].value, 179);
  assert.equal(result.results[0].characterPoints.spent, 995);
});

test('Automatic allocation satisfies item prerequisites using real stats and independent scrolls', async () => {
  const catalog = fixture();
  catalog.items = [{ ...catalog.items[0], stats: { strength: 30, damagePercent: 200 },
    conditions: { kind: 'stat', stat: 'strength', operator: '>', value: 300 } }];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.character.scrollStats = { strength: 100 };
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [{ id: 'hp', kind: 'stat', statKey: 'vitality', target: 1_000, relation: 'maximize', priority: 0, strict: false }];
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.ok(result.results.length > 0);
  assert.equal(result.results[0].build.baseStats?.strength, 171);
  assert.equal(result.results[0].stats.strength, 301);
  assert.equal(result.results[0].build.baseStats?.vitality, 753);
  assert.equal(result.results[0].characterPoints.spent, 995);
});

test('A stale automatic allocation is recomputed at the new level and a manual allocation is preserved', async () => {
  const catalog = fixture();
  catalog.items = [catalog.items[0]];
  const input = request();
  input.character.level = 100;
  input.character.allocationMode = 'automatic';
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [{ id: 'str', kind: 'stat', statKey: 'strength', target: 500, relation: 'maximize', priority: 0, strict: false }];
  input.initialBuild = { slots: { hat: 1 }, baseStats: { strength: 398, vitality: 3 } };
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.equal(result.results[0].characterPoints.available, 495);
  assert.equal(result.results[0].characterPoints.spent, 495);
  assert.equal(result.results[0].build.baseStats?.strength, 265);
  input.character.allocationMode = 'manual';
  input.character.baseStats = { strength: 50 };
  delete input.initialBuild;
  const manual = await optimize(catalog, input, { onProgress: async () => false });
  assert.equal(manual.stopReason, 'fixed');
  assert.equal(manual.results[0].stats.strength, 50);
  assert.equal(manual.results[0].characterPoints.spent, 50);
});

test('Allocation mutations release surplus above a satisfied threshold to improve the actual ranked objective', async () => {
  const catalog = fixture();
  catalog.items = [{ ...catalog.items[0], stats: { strength: 30 },
    conditions: { kind: 'stat', stat: 'strength', operator: '>', value: 300 } }];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.character.scrollStats = { strength: 100 };
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = [
    { id: 'wis', kind: 'stat', statKey: 'wisdom', target: 500, relation: 'maximize', priority: 0, strict: false },
    { id: 'chance', kind: 'stat', statKey: 'chance', target: 100, relation: 'atLeast', priority: 1, strict: true },
  ];
  const result = await optimize(catalog, input, { onProgress: async update => (update.results[0]?.stats.wisdom || 0) >= 217 });
  assert.ok(result.progress.evaluated > 10, 'This optimum requires allocation mutations beyond the weighted seed.');
  assert.ok(result.results[0].stats.strength >= 301);
  assert.ok(result.results[0].stats.chance >= 100);
  assert.equal(result.results[0].stats.wisdom, 217);
  assert.equal(result.results[0].characterPoints.spent, 995);
  assert.equal(result.results.length, 1);
});

test('Automatic allocation may leave its entire budget unused when strict upper bounds require it', async () => {
  const catalog = fixture();
  catalog.items = [{ ...catalog.items[0], stats: {} }];
  const input = request();
  input.character.allocationMode = 'automatic';
  input.filters.lockedSlots = { hat: 1 };
  input.constraints = ['vitality', 'strength', 'intelligence', 'chance', 'agility', 'wisdom'].map(statKey => ({
    id: statKey, kind: 'stat', statKey, target: 0, relation: 'atMost', priority: 0, strict: true,
  }));
  const result = await optimize(catalog, input, { onProgress: async () => true });
  assert.ok(result.results.length > 0);
  assert.equal(result.results[0].valid, true);
  assert.equal(result.results[0].characterPoints.spent, 0);
  assert.equal(result.results[0].characterPoints.remaining, 995);
});

test('A locked item overrides its type exclusion without reopening the rest of that type', async () => {
  const input = request();
  input.filters.excludedTypeIds = [16, 1];
  input.filters.lockedSlots = { hat: 2 };
  const result = await optimize(fixture(), input, { onProgress: async () => true });
  assert.equal(result.results[0].build.slots.hat, 2);
  assert.equal(result.results[0].build.slots.amulet, undefined);
});
