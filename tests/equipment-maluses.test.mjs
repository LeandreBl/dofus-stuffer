import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateEquipmentMaluses, defaultTarget, evaluateBuild } from '../packages/shared/dist/index.js';

const native = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const item = (id, stats, extra = {}) => ({ id, name: `Objet ${id}`, level: 1, typeId: 16, typeName: 'Coiffe', slotType: 'hat', category: 'equipment', icon: '', stats, ...extra });
const request = () => ({ character: { classId: 9, level: 200, allocationMode: 'manual', baseStats: {} },
  constraints: [{ id: 'strength', kind: 'stat', statKey: 'strength', target: 1000, relation: 'maximize', priority: 0, strict: false }],
  target: defaultTarget(), filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
  prices: { server: native.servers[0], values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3 });
const catalog = (items, sets = []) => ({ ...native, items, sets });

test('large losses outside objectives outweigh a small desired-stat gain, but a tiny malus does not', () => {
  const data = catalog([item(1, { strength: 500, tackleEvade: -150 }), item(2, { strength: 490 }), item(3, { strength: 500, agility: -1 })]);
  const input = request();
  const harmful = evaluateBuild(data, input, { slots: { hat: 1 } });
  const balanced = evaluateBuild(data, input, { slots: { hat: 2 } });
  const tiny = evaluateBuild(data, input, { slots: { hat: 3 } });
  assert.ok(balanced.score > harmful.score);
  assert.ok(tiny.score > balanced.score);
  assert.equal(harmful.valid, true, 'A malus is a preference, not an equipment prohibition.');
  assert.equal(harmful.constraints[0].score, 1 / 3);
  assert.equal(harmful.maluses.penalty, 75);
});

test('permanent malus lines remain counted when other gear, scrolls and allocation compensate them', () => {
  const data = catalog([item(1, { strength: 500, agility: -100 }), item(2, { agility: 300 }, { slotType: 'cape', typeId: 17 })]);
  const input = request();
  input.character.baseStats = { agility: 100 };
  input.character.scrollStats = { agility: 100 };
  const result = evaluateBuild(data, input, { slots: { hat: 1, cape: 2 } });
  assert.equal(result.stats.agility, 400);
  assert.deepEqual(result.maluses.stats, { agility: -100 });
  assert.equal(result.maluses.penalty, 2.5);
});

test('active set maluses and both legal repeated rings are counted once per source without derived duplicates', () => {
  const data = catalog([
    item(1, { agility: -100, vitality: -350 }, { setId: 7 }),
    item(2, {}, { slotType: 'cape', typeId: 17, setId: 7 }),
    item(3, { tackleEvade: -10 }, { slotType: 'ring', typeId: 9 }),
  ], [{ id: 7, name: 'Panoplie', bonuses: [{ count: 2, stats: { wisdom: -60, strength: 200 } }, { count: 3, stats: { wisdom: -300 } }] }]);
  const result = evaluateBuild(data, request(), { slots: { hat: 1, cape: 2, ring1: 3, ring2: 3 } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.maluses.stats, { agility: -100, vitality: -350, tackleEvade: -20, wisdom: -60 });
  assert.equal(result.maluses.penalty, 20);
  assert.equal(result.stats.hitPoints, 700);
  assert.equal(result.stats.initiative, 100, 'Derived initiative is not charged again as a malus.');
});

test('malus severity is progressive, normalized by stat, and independent of the number or order of objectives', () => {
  const examples = ['criticalHit', 'range', 'actionPoints', 'movementPoints', 'earthElementResistPercent', 'receivedDamageMultiplierDistance', 'damagePercent'];
  for (const key of examples) {
    const small = calculateEquipmentMaluses(native, [{ [key]: -1 }]);
    const large = calculateEquipmentMaluses(native, [{ [key]: -100 }]);
    assert.ok(small.penalty > 0, key);
    assert.ok(Math.abs(large.penalty - 100 * small.penalty) < 1e-9, key);
  }
  assert.ok(calculateEquipmentMaluses(native, [{ actionPoints: -1 }]).penalty > calculateEquipmentMaluses(native, [{ strength: -1 }]).penalty);
  const data = catalog([item(1, { strength: 500, damagePercent: -200 })]);
  const input = request();
  const once = evaluateBuild(data, input, { slots: { hat: 1 } });
  input.constraints = [input.constraints[0], { ...input.constraints[0], id: 'second', priority: 1 }];
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 } }).maluses.penalty, once.maluses.penalty);
  assert.deepEqual(once.maluses.stats, { damagePercent: -200 }, 'Power loss is not charged once per element.');
});

test('negative effects never relax mandatory minima, and no-objective searches still prefer fewer maluses', () => {
  const data = catalog([item(1, { strength: 500, tackleEvade: -150 }), item(2, { strength: 490 })]);
  const input = request();
  input.constraints = [{ ...input.constraints[0], target: 500, relation: 'atLeast', strict: true }];
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 } }).valid, true);
  assert.equal(evaluateBuild(data, input, { slots: { hat: 2 } }).valid, false);
  input.constraints = [];
  assert.equal(evaluateBuild(data, input, { slots: { hat: 2 } }).score, 0);
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 } }).score, -75);
});

test('positive resistance and utility bonuses, technical fields and non-finite input do not create maluses', () => {
  assert.deepEqual(calculateEquipmentMaluses(native, [{ strength: 500, tackleEvade: 50, receivedDamageMultiplierDistance: 10,
    criticalMiss: -10, extraScale: -10, level: -200, agility: Number.NaN, wisdom: -Infinity }]), { stats: {}, penalty: 0 });
});
