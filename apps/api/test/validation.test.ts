import test from 'node:test';
import assert from 'node:assert/strict';
import type { Catalog, OptimizationRequest } from '@dofus/shared';
import { validateRequest } from '../src/validation.js';

const catalog: Catalog = {
  version: 'fixture', fetchedAt: '', source: 'test', classes: [{ id: 9, name: 'Crâ', icon: '' }],
  stats: [{ id: 11, key: 'vitality', name: 'Vitalité', category: 'Base' }], spells: [],
  items: [{ id: 1, name: 'Objet de test', level: 1, typeId: 1, typeName: 'Amulette', category: 'Équipement', slotType: 'amulet', stats: {}, icon: '' }],
  sets: [], servers: ['Serveur de test'],
};
const request = (): OptimizationRequest => ({
  character: { classId: 9, level: 200, baseStats: {} },
  constraints: [{ id: 'vitality', kind: 'stat', statKey: 'vitality', target: 4_000, relation: 'atLeast', priority: 0, strict: true }],
  target: { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' },
  filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
  prices: { server: 'Serveur de test', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
});

test('native spell situations are preserved, bounded and restricted to spell damage objectives',()=>{
  const data={...catalog,spells:[{id:42,name:'Fixture',description:'',classIds:[9],icon:'',levels:[]}]};
  const input=request();
  input.constraints=[{id:'spell',kind:'spell',spellId:42,target:100,relation:'atLeast',priority:0,strict:true,mode:'normal',scenario:{casterStates:[707],baseDamageBonus:18,triggerCount:2,randomChoices:{'random:1:1':[1,2]},summonSpellId:31154}}];
  assert.deepEqual(validateRequest(input,data).constraints[0].scenario,input.constraints[0].scenario);
  for(const scenario of [{triggerCount:21},{casterHpPercent:101},{blockedPushCells:-1},{randomChoices:{test:[-1]}},{unknown:true}])assert.throws(()=>validateRequest({...input,constraints:[{...input.constraints[0],scenario}]},data));
  assert.throws(()=>validateRequest({...request(),constraints:[{...request().constraints[0],scenario:{}}]},data));
  assert.throws(()=>validateRequest({...input,constraints:[{...input.constraints[0],metric:'criticalChance',mode:undefined,scenario:{}}]},data));
});

test('With-power flags are preserved only on elemental characteristic objectives and must be booleans', () => {
  const elementalCatalog = { ...catalog, stats: [...catalog.stats, ...['strength', 'intelligence', 'chance', 'agility', 'damagePercent'].map((key, index) =>
    ({ id: 100 + index, key, name: key, category: 'Base' }))] };
  for (const statKey of ['strength', 'intelligence', 'chance', 'agility']) {
    for (const includePower of [true, false]) {
      const input = request();
      input.constraints[0] = { ...input.constraints[0], statKey, includePower };
      assert.equal(validateRequest(input, elementalCatalog).constraints[0].includePower, includePower);
    }
  }
  for (const extra of [{ statKey: 'vitality' }, { statKey: 'damagePercent' }, { kind: 'price' }, { kind: 'weapon' }]) {
    for (const includePower of [true, false]) assert.throws(() => validateRequest({ ...request(),
      constraints: [{ ...request().constraints[0], includePower, ...extra }] }, elementalCatalog));
  }
  for (const includePower of [1, 'true', null]) assert.throws(() => validateRequest({ ...request(),
    constraints: [{ ...request().constraints[0], statKey: 'strength', includePower }] }, elementalCatalog));
  assert.equal(validateRequest(request(), catalog).constraints[0].includePower, undefined);
});

test('Weapon damage and critical chance objectives coexist and follow the equipped weapon', () => {
  const input = request();
  input.constraints = [
    { id: 'weapon-damage', kind: 'weapon', target: 1000, relation: 'maximize', priority: 0, strict: false, mode: 'critical', metric: 'average' },
    { id: 'weapon-chance', kind: 'weapon', target: 75, relation: 'atLeast', priority: 0, strict: true, metric: 'criticalChance' },
  ];
  const parsed = validateRequest(input, catalog);
  assert.deepEqual(parsed.constraints, input.constraints);
});

test('Weapon objectives reject spell identifiers, stat keys, delayed turns and invalid critical options', () => {
  const input = request();
  input.constraints = [{ id: 'weapon', kind: 'weapon', target: 1000, relation: 'atLeast', priority: 0, strict: true, mode: 'normal', metric: 'min' }];
  for (const extra of [{ spellId: 42 }, { statKey: 'vitality' }, { turnOffset: 0 }, { turnOffset: 1 },
    { metric: 'criticalChance', mode: 'critical' }, { metric: 'criticalChance', mode: undefined, target: 101 }]) {
    assert.throws(() => validateRequest({ ...input, constraints: [{ ...input.constraints[0], ...extra }] }, catalog));
  }
});

test('Validation preserves required threshold, priorities and explicitly zero prices', () => {
  const input = request();
  input.prices.values['1'] = 0;
  const parsed = validateRequest(input, catalog);
  assert.equal(parsed.constraints[0].strict, true);
  assert.equal(parsed.prices.values['1'], 0);
  assert.equal(parsed.constraints[0].priority, 0);
});

test('Search duration accepts up to ten minutes and rejects longer or malformed budgets', () => {
  for (const seconds of [3, 15, 120, 300, 600]) {
    assert.equal(validateRequest({ ...request(), seconds }, catalog).seconds, seconds);
  }
  for (const seconds of [2, 601, 600.5, NaN, Infinity, '600', null]) {
    assert.throws(() => validateRequest({ ...request(), seconds }, catalog));
  }
});

test('Rejects arbitrary spell IDs, unknown stats, duplicate constraints and unbounded jobs', () => {
  for (const mutate of [
    (value: OptimizationRequest) => { value.constraints[0].statKey = 'unknown'; },
    (value: OptimizationRequest) => { value.constraints.push({ ...value.constraints[0] }); },
    (value: OptimizationRequest) => { value.seconds = 10_000; },
    (value: OptimizationRequest) => { value.filters.lockedSlots.hat = 999; },
    (value: OptimizationRequest) => { value.constraints[0] = { ...value.constraints[0], kind: 'spell', spellId: 999 }; },
    (value: OptimizationRequest) => { value.prices.values['999'] = 0; },
  ]) {
    const input = request();
    mutate(input);
    assert.throws(() => validateRequest(input, catalog));
  }
});

test('Rejects strict maximize criteria without a threshold and non-finite numbers', () => {
  const input = request();
  input.constraints[0].relation = 'maximize';
  assert.throws(() => validateRequest(input, catalog));
  input.constraints[0].relation = 'atLeast';
  input.constraints[0].target = Infinity;
  assert.throws(() => validateRequest(input, catalog));
});

test('Player thresholds accept the PA, PM, PO and five elemental resistance caps, and reject higher targets', () => {
  const caps = { actionPoints: 12, movementPoints: 6, range: 6,
    neutralElementResistPercent: 50, earthElementResistPercent: 50, fireElementResistPercent: 50,
    waterElementResistPercent: 50, airElementResistPercent: 50 };
  const extended: Catalog = { ...catalog, stats: [...catalog.stats,
    ...Object.keys(caps).map((key, index) => ({ id: index + 100, key, name: key, category: 'Combat' })),
  ] };
  for (const [statKey, cap] of Object.entries(caps)) {
    for (const relation of ['atLeast', 'atMost'] as const) {
      const input = request();
      input.constraints[0] = { ...input.constraints[0], statKey, relation, target: cap };
      assert.equal(validateRequest(input, extended).constraints[0].target, cap);
      input.constraints[0].target = cap + 1;
      assert.throws(() => validateRequest(input, extended));
    }
  }
});

test('Player caps preserve flat resistances, monster resistances and old maximize score scales', () => {
  const extended: Catalog = { ...catalog, stats: [...catalog.stats,
    ...['earthElementResistPercent', 'earthElementReduction', 'criticalDamageReduction'].map((key, index) =>
      ({ id: index + 100, key, name: key, category: 'Combat' })),
  ] };
  const input = request();
  input.target.percent = { earth: 80, fire: -50 };
  input.constraints = [
    { ...input.constraints[0], id: 'flat', statKey: 'earthElementReduction', target: 150 },
    { ...input.constraints[0], id: 'critical', statKey: 'criticalDamageReduction', target: 150 },
    { ...input.constraints[0], id: 'maximize', statKey: 'earthElementResistPercent', target: 100, relation: 'maximize', strict: false },
  ];
  const parsed = validateRequest(input, extended);
  assert.equal(parsed.constraints[0].target, 150);
  assert.equal(parsed.constraints[1].target, 150);
  assert.equal(parsed.constraints[2].target, 100);
  assert.deepEqual(parsed.target.percent, { earth: 80, fire: -50 });
});

test('A spell can have separate damage and critical chance thresholds, including 0 and 100 percent', () => {
  const spells: Catalog = { ...catalog, spells: [{ id: 42, name: 'Sort de test', description: '', classIds: [9], icon: '', levels: [] }] };
  const input = request();
  input.constraints = [
    { id: 'damage', kind: 'spell', spellId: 42, metric: 'min', mode: 'critical', turnOffset: 2,
      target: 1_000, relation: 'atLeast', priority: 0, strict: true },
    { id: 'probability', kind: 'spell', spellId: 42, metric: 'criticalChance',
      target: 100, relation: 'atLeast', priority: 0, strict: true },
  ];
  const parsed = validateRequest(input, spells);
  assert.equal(parsed.constraints.length, 2);
  assert.equal(parsed.constraints[0].metric, 'min');
  assert.equal(parsed.constraints[1].metric, 'criticalChance');
  assert.equal(parsed.constraints[1].target, 100);
  input.constraints[1].target = 0;
  input.constraints[1].relation = 'atMost';
  assert.equal(validateRequest(input, spells).constraints[1].target, 0);
});

test('Spell critical chance rejects invalid percentages, other criterion kinds and damage-only options', () => {
  const spells: Catalog = { ...catalog, spells: [{ id: 42, name: 'Sort de test', description: '', classIds: [9], icon: '', levels: [] }] };
  const input = request();
  const criterion = { id: 'probability', kind: 'spell' as const, spellId: 42, metric: 'criticalChance' as const,
    target: 50, relation: 'atLeast' as const, priority: 0, strict: true };
  for (const change of [
    { target: -1 }, { target: 101 }, { target: Infinity }, { target: NaN },
    { kind: 'stat', statKey: 'vitality' }, { kind: 'price' }, { mode: 'normal' }, { mode: 'critical' }, { turnOffset: 0 },
  ]) assert.throws(() => validateRequest({ ...input, constraints: [{ ...criterion, ...change }] }, spells));
});

test('Contradictory locks are rejected before a long job is queued', () => {
  const input = request();
  input.filters.lockedSlots.hat = 1;
  assert.throws(() => validateRequest(input, catalog));
  input.filters.lockedSlots = { amulet: 1 };
  input.filters.excludedItemIds = [1];
  assert.throws(() => validateRequest(input, catalog));
});

test('Two copies of an ordinary ring can be locked, but set rings cannot', () => {
  const rings: Catalog = { ...catalog, items: [{ ...catalog.items[0], slotType: 'ring' }] };
  const input = request();
  input.filters.lockedSlots = { ring1: 1, ring2: 1 };
  assert.doesNotThrow(() => validateRequest(input, rings));
  rings.items[0].setId = 77;
  assert.throws(() => validateRequest(input, rings));
});

test('Non-upgradable stats cannot be injected as natural character stats', () => {
  const extended = { ...catalog, stats: [...catalog.stats, { id: 1, key: 'actionPoints', name: 'PA', category: 'Base' }] };
  const input = request();
  input.character.baseStats.actionPoints = 5;
  assert.throws(() => validateRequest(input, extended));
  input.character.baseStats = { vitality: 100 };
  assert.doesNotThrow(() => validateRequest(input, extended));
});

test('Character investment follows level points and stat tiers independently from scrolling', () => {
  const extended: Catalog = { ...catalog, stats: [...catalog.stats,
    ...['strength', 'chance', 'wisdom'].map((key, id) => ({ key, id: id + 100, name: key, category: 'Base' })),
  ] };
  const input = request();
  input.character.level = 100;
  input.character.baseStats = { strength: 200, chance: 100, wisdom: 31 }; // 300 + 100 + 93 of 495 points.
  input.character.scrollStats = { strength: 100, chance: 100, wisdom: 100 };
  const parsed = validateRequest(input, extended);
  assert.equal(parsed.character.scrollStats?.strength, 100);
  input.character.baseStats.wisdom = 32;
  assert.throws(() => validateRequest(input, extended));
  input.character.baseStats = {};
  input.character.scrollStats.strength = 101;
  assert.throws(() => validateRequest(input, extended));
  input.character.scrollStats = {};
  input.character.level = 1;
  input.character.baseStats.vitality = 1;
  assert.throws(() => validateRequest(input, extended));
});

test('Global exotic bonuses need authorization without any item assignment', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.filters.lockedSlots = { amulet: 1 };
  input.initialBuild = { slots: { amulet: 1 }, exoBonuses: ['actionPoints', 'movementPoints'] };
  input.prices.exoCosts = { actionPoints: 10_000, movementPoints: 0 };
  const parsed = validateRequest(input, catalog);
  assert.deepEqual(parsed.initialBuild?.exoBonuses, ['actionPoints', 'movementPoints']);
  assert.equal(parsed.prices.exoCosts?.movementPoints, 0);
  input.filters.allowedExos = [];
  assert.throws(() => validateRequest(input, catalog));
});

test('Duplicate bonuses, malformed global costs and obsolete item exos are rejected', () => {
  const baseline = request();
  baseline.filters.allowedExos = ['actionPoints', 'movementPoints'];
  for (const changed of [
    { initialBuild: { slots: {}, exoBonuses: ['actionPoints', 'actionPoints'] } },
    { initialBuild: { slots: {}, exoBonuses: ['range'] } },
    { initialBuild: { slots: { amulet: 1 }, exos: { amulet: 'actionPoints' } } },
    { filters: { ...baseline.filters, allowedExos: ['actionPoints', 'actionPoints'] } },
    { filters: { ...baseline.filters, lockedExos: { amulet: 'actionPoints' } } },
    { prices: { ...baseline.prices, ownedExos: ['actionPoints', 'actionPoints'] } },
    { prices: { ...baseline.prices, exoCosts: { actionPoints: -1 } } },
    { prices: { ...baseline.prices, exoCosts: { actionPoints: Infinity } } },
    { prices: { ...baseline.prices, exoCosts: { '1:pa': 100 } } },
    { prices: { ...baseline.prices, exoValues: { '1:pa': 100 } } },
    { prices: { ...baseline.prices, ownedExoKeys: ['1:pa'] } },
  ]) assert.throws(() => validateRequest({ ...baseline, ...changed }, catalog));
});

test('Global exo costs and ownership are independent of the selected items', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.initialBuild = { slots: {}, exoBonuses: ['actionPoints'] };
  input.prices.exoCosts = { actionPoints: 10_000 };
  input.prices.ownedExos = ['actionPoints'];
  assert.doesNotThrow(() => validateRequest(input, catalog));
});

test('The global exo ceiling accepts only integers from zero to two and stays optional for older requests', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  assert.equal(validateRequest(input, catalog).filters.maxExos, undefined);
  for (const maxExos of [0, 1, 2]) {
    input.filters.maxExos = maxExos;
    const parsed = validateRequest(input, catalog);
    assert.equal(parsed.filters.maxExos, maxExos);
    assert.deepEqual(parsed.filters.allowedExos, ['actionPoints', 'movementPoints']);
  }
  for (const maxExos of [-1, 3, 0.5, NaN, Infinity, '1', null]) {
    assert.throws(() => validateRequest({ ...input, filters: { ...input.filters, maxExos } }, catalog));
  }
});

test('Initial global bonuses cannot exceed the ceiling even when both types are allowed or already owned', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.prices.ownedExos = ['actionPoints', 'movementPoints'];
  input.initialBuild = { slots: { amulet: 1 }, exoBonuses: ['actionPoints', 'movementPoints'] };
  for (const maxExos of [0, 1]) {
    input.filters.maxExos = maxExos;
    assert.throws(() => validateRequest(input, catalog));
  }
  input.filters.maxExos = 2;
  assert.doesNotThrow(() => validateRequest(input, catalog));
  input.initialBuild.exoBonuses = ['movementPoints'];
  input.filters.maxExos = 1;
  assert.doesNotThrow(() => validateRequest(input, catalog));
  input.initialBuild.exoBonuses = [];
  input.filters.maxExos = 0;
  assert.doesNotThrow(() => validateRequest(input, catalog));
});

test('Automatic allocation discards an outdated seed after a level decrease, while manual allocation remains strict', () => {
  const input = request();
  input.character.level = 100;
  input.character.allocationMode = 'automatic';
  input.initialBuild = { slots: { amulet: 1 }, baseStats: { strength: 398, vitality: 3 } };
  const parsed = validateRequest(input, catalog);
  assert.equal(parsed.character.allocationMode, 'automatic');
  assert.equal(parsed.initialBuild?.baseStats, undefined);
  input.character.allocationMode = 'manual';
  assert.throws(() => validateRequest(input, catalog));
});
