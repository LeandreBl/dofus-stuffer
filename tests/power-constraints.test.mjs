import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCharacter, defaultTarget, evaluateBuild } from '../packages/shared/dist/index.js';

const elements = ['strength', 'intelligence', 'chance', 'agility'];
const catalog = {
  classes: [], stats: [], spells: [], sets: [], items: [{
    id: 1, name: 'Coiffe de test', level: 1, slotType: 'hat', typeId: 16, category: 'equipment',
    stats: { strength: 20, intelligence: 30, chance: 40, agility: 50, damagePercent: 150 },
  }],
};
const request = () => ({
  character: { ...defaultCharacter(), allocationMode: 'manual',
    baseStats: Object.fromEntries(elements.map(key => [key, 100])),
    scrollStats: Object.fromEntries(elements.map(key => [key, 50])) },
  constraints: [], target: defaultTarget(),
  filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} },
  prices: { server: 'test', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3,
});
const criterion = (statKey, rest = {}) => ({
  id: statKey, kind: 'stat', statKey, target: 300, relation: 'atLeast', priority: 0, strict: true, ...rest,
});

test('with-power objectives add power exactly once to base, scrolls and equipment, independently of plain objectives', () => {
  const input = request();
  input.constraints = elements.flatMap((key, index) => [
    criterion(key, { id: `${key}-plain`, target: 170 + index * 10 }),
    criterion(key, { id: `${key}-power`, includePower: true, target: 320 + index * 10 }),
  ]);
  const result = evaluateBuild(catalog, input, { slots: { hat: 1 } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.constraints.map(entry => entry.value), [170, 320, 180, 330, 190, 340, 200, 350]);
  assert.ok(result.constraints.every(entry => entry.satisfied && entry.supported));
  assert.equal(result.stats.strength, 170);
  assert.equal(result.breakdown.strength.total, 170);
  assert.equal(result.breakdown.strength.power, 150);
  assert.equal(result.stats.magicFind, 119);
  assert.equal(result.stats.initiative, 740);
  assert.equal(result.stats.weight, 1850);
  assert.equal(result.stats.tackleBlock, 20);
  assert.equal(result.stats.tackleEvade, 20);
});

test('power contributes to lower bounds, upper bounds and maximization without altering equipment prerequisites', () => {
  const input = request();
  input.constraints = [
    criterion('strength', { id: 'min', includePower: true, target: 320 }),
    criterion('strength', { id: 'max', includePower: true, target: 300, relation: 'atMost', strict: false }),
    criterion('strength', { id: 'maximize', includePower: true, relation: 'maximize', strict: false }),
  ];
  const result = evaluateBuild(catalog, input, { slots: { hat: 1 } });
  assert.deepEqual(result.constraints.map(entry => entry.satisfied), [true, false, true]);
  input.constraints[1].strict = true;
  assert.equal(evaluateBuild(catalog, input, { slots: { hat: 1 } }).valid, false);
  input.constraints = [input.constraints[0]];
  const conditional = { ...catalog, items: [{ ...catalog.items[0],
    conditions: { kind: 'stat', stat: 'strength', operator: '>', value: 299 } }] };
  const restricted = evaluateBuild(conditional, input, { slots: { hat: 1 } });
  assert.equal(restricted.constraints[0].satisfied, true);
  assert.equal(restricted.valid, false);
  assert.ok(restricted.violations.some(entry => entry.startsWith('Conditions non remplies')));
});

test('disabled flags preserve old constraints, negative power stays signed, and unsupported stats cannot use the flag', () => {
  const input = request();
  input.constraints = [criterion('strength', { includePower: false, target: 170 })];
  assert.equal(evaluateBuild(catalog, input, { slots: { hat: 1 } }).constraints[0].value, 170);
  input.constraints[0].includePower = true;
  const negative = { ...catalog, items: [{ ...catalog.items[0], stats: { strength: 20, damagePercent: -50 } }] };
  assert.equal(evaluateBuild(negative, input, { slots: { hat: 1 } }).constraints[0].value, 120);
  for (const statKey of ['vitality', 'wisdom', 'magicFind', 'healBonus', 'tackleEvade', 'actionPoints', 'damagePercent']) {
    input.constraints = [criterion(statKey, { includePower: true, target: 0 })];
    const result = evaluateBuild(catalog, input, { slots: { hat: 1 } });
    assert.equal(result.constraints[0].supported, false, statKey);
    assert.equal(result.valid, false, statKey);
  }
});
