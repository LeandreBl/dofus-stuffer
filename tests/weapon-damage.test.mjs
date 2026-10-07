import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeaponCriticalChance, calculateWeaponDamage, defaultCharacter, defaultTarget, evaluateBuild } from '../packages/shared/dist/index.js';

const effect = (effectId, diceNum, diceSide = diceNum, rest = {}) => ({ effectId, diceNum, diceSide, value: 0, ...rest });
const weapon = (id = 1, rest = {}) => ({
  id, name: `Arme ${id}`, level: 1, typeId: 6, typeName: 'Épée', category: 'Équipements', slotType: 'weapon', icon: '', stats: {},
  weapon: { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 },
  effects: [effect(97, 10, 12)], ...rest,
});
const request = () => ({ character: defaultCharacter(), constraints: [], target: defaultTarget(), filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} }, prices: { server: 'Draconiros', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3 });
const catalog = items => ({ version: 'test', fetchedAt: '', source: '', classes: [], stats: [], spells: [], sets: [], servers: [], items });
const damageConstraint = rest => ({ id: 'damage', kind: 'weapon', target: 10, relation: 'atLeast', strict: true, priority: 0, mode: 'normal', metric: 'min', ...rest });

test('weapon critical bonus increases the base of each direct and life-steal line before stats', () => {
  const item = weapon(1, { effects: [effect(97, 10, 12), effect(94, 5)] });
  const result = calculateWeaponDamage(item, { strength: 100, intelligence: 200, damagePercent: 50, allDamageBonus: 2, earthDamageBonus: 3, criticalDamageBonus: 7, criticalHit: 30 });
  assert.equal(result.supported, true);
  assert.deepEqual(result.lines[0].normal, { min: 30, average: 32.333333333333336, max: 35 });
  assert.deepEqual(result.lines[0].critical, { min: 49, average: 51.666666666666664, max: 54 });
  assert.deepEqual(result.lines[1].normal, { min: 19, average: 19, max: 19 });
  assert.deepEqual(result.lines[1].critical, { min: 44, average: 44, max: 44 });
  assert.equal(result.normal.min, 49);
  assert.equal(result.critical.min, 93);
  assert.equal(result.critChance, 50);
  assert.equal(result.expected, (result.normal.average + result.critical.average) / 2);
  assert.equal(result.perAp, result.expected / 4);
  assert.equal(result.itemId, 1);
  assert.equal('turns' in result, false);
});

test('weapon percent damage is independent from spell damage and respects target distance', () => {
  const item = weapon(1, { effects: [effect(97, 100)] });
  const stats = { dealtDamageMultiplierWeapon: 20, dealtDamageMultiplierSpells: 500, dealtDamageMultiplierDistance: 50, dealtDamageMultiplierMelee: 10, dealtDamageMultiplier: 10 };
  const ranged = calculateWeaponDamage(item, stats);
  const melee = calculateWeaponDamage(item, stats, { ...defaultTarget(), distance: 'melee' });
  assert.equal(ranged.normal.min, 198);
  assert.equal(melee.normal.min, 145);
  assert.equal(calculateWeaponDamage(item, { ...stats, dealtDamageMultiplierSpells: 0 }).normal.min, ranged.normal.min);
});

test('flat and critical resistances apply separately on every weapon line', () => {
  const item = weapon(1, { effects: [effect(97, 10), effect(97, 10)] });
  const target = { ...defaultTarget(), percent: { earth: 20 }, flat: { earth: 5 }, criticalResistance: 10 };
  const result = calculateWeaponDamage(item, { strength: 100, allDamageBonus: 5, criticalDamageBonus: 10 }, target);
  assert.equal(result.normal.min, 32);
  assert.equal(result.critical.min, 48);
  assert.equal(calculateWeaponDamage(item, {}, { ...target, percent: { earth: 100 } }).critical.min, 0);
});

test('weapon power increases damage as a flat characteristic and neutral damage uses strength', () => {
  const item = weapon(1, { effects: [effect(100, 10)] });
  assert.equal(calculateWeaponDamage(item, { strength: 100, damagePercent: 50, weaponPower: 200 }).normal.min, 45);
  assert.equal(calculateWeaponDamage(item, { strength: -100, damagePercent: -100 }).normal.min, 10);
});

test('ordinary equipment effects and metadata do not become attack mechanics or double bonuses', () => {
  const item = weapon(1, { stats: { strength: 100 }, effects: [effect(97, 10), effect(118, 100), effect(795, 1), effect(9999, 5, 5, { isInFight: false })] });
  const result = calculateWeaponDamage(item, { strength: 100 });
  assert.equal(result.supported, true);
  assert.equal(result.normal.min, 20);
  assert.equal(result.lines.length, 1);
  assert.equal(result.warnings.length, 0);
});

test('AP/MP removal is reported separately without inflating attack damage', () => {
  const item = weapon(1, { effects: [effect(97, 10), effect(101, 1, 1, { isInFight: true }), effect(127, 1, 1, { isInFight: true })] });
  const result = calculateWeaponDamage(item, {});
  assert.equal(result.supported, true);
  assert.equal(result.normal.min, 10);
  assert.match(result.warnings.join(' '), /retrait de PA\/PM/);
});

test('missing or invalid metadata, non-weapons and unavailable levels cannot certify an attack', () => {
  for (const item of [weapon(1, { weapon: undefined }), weapon(1, { slotType: 'hat' }), weapon(1, { level: 201 }), weapon(1, { weapon: { ...weapon().weapon, apCost: 0 } })]) {
    assert.equal(calculateWeaponCriticalChance(item, {}), null);
    assert.equal(calculateWeaponDamage(item, {}).supported, false);
  }
});

test('non-critical weapons stay non-critical even with large equipment bonuses', () => {
  const item = weapon(1, { weapon: { ...weapon().weapon, criticalHitProbability: 0 } });
  assert.equal(calculateWeaponCriticalChance(item, { criticalHit: 100 }), 0);
  assert.equal(calculateWeaponDamage(item, { criticalHit: 100 }).critical, null);
  assert.equal(calculateWeaponCriticalChance(weapon(), { criticalHit: 100 }), 100);
  assert.equal(calculateWeaponCriticalChance(weapon(), { criticalHit: -100 }), 0);
  const input = request();
  input.constraints = [damageConstraint({ mode: 'critical' })];
  const evaluation = evaluateBuild(catalog([item]), input, { slots: { weapon: 1 } });
  assert.equal(evaluation.valid, false);
  assert.equal(evaluation.constraints[0].supported, false);
});

test('unmodelled healing, variable-element, conditional and unknown attack mechanics are explicit partial previews', () => {
  for (const extra of [effect(108, 10), effect(2822, 10), effect(9999, 10), effect(97, 10, 12, { delay: 1 }), effect(97, 10, 12, { targetMask: 'C' })]) {
    const result = calculateWeaponDamage(weapon(1, { effects: [effect(97, 10), extra] }), {});
    assert.equal(result.supported, false, `effect ${extra.effectId}`);
    assert.ok(result.warnings.length > 0);
  }
  const support = weapon(1, { effects: [effect(108, 10)] });
  assert.equal(calculateWeaponDamage(support, {}).supported, false);
  assert.equal(calculateWeaponCriticalChance(support, { criticalHit: 30 }), 50);
});

test('weapon constraints follow the equipped weapon and pair damage with critical chance independently', () => {
  const first = weapon(1);
  const second = weapon(2, { effects: [effect(97, 30)], weapon: { ...weapon().weapon, criticalHitProbability: 40 } });
  const input = request();
  input.constraints = [damageConstraint({ target: 20 }), damageConstraint({ id: 'critical', metric: 'criticalChance', target: 40 })];
  const data = catalog([first, second]);
  const firstEvaluation = evaluateBuild(data, input, { slots: { weapon: 1 } });
  const secondEvaluation = evaluateBuild(data, input, { slots: { weapon: 2 } });
  assert.deepEqual(firstEvaluation.constraints.map(entry => entry.value), [10, 20]);
  assert.deepEqual(secondEvaluation.constraints.map(entry => entry.value), [30, 40]);
  assert.equal(firstEvaluation.valid, false);
  assert.equal(secondEvaluation.valid, true);
  assert.equal(evaluateBuild(data, input, { slots: {} }).constraints[0].supported, false);
});

test('strict weapon targets reject unmodelled equipment modifiers but do not break a soft preview', () => {
  const sword = weapon();
  const hat = { ...weapon(2), slotType: 'hat', unsupportedEffects: ['Effet passif non simulé'] };
  const data = catalog([sword, hat]);
  const input = request();
  input.constraints = [damageConstraint(), damageConstraint({ id: 'rate', metric: 'criticalChance', target: 20 })];
  const strict = evaluateBuild(data, input, { slots: { weapon: 1, hat: 2 } });
  assert.deepEqual(strict.constraints.map(entry => entry.supported), [false, false]);
  input.constraints.forEach(entry => { entry.strict = false; });
  assert.deepEqual(evaluateBuild(data, input, { slots: { weapon: 1, hat: 2 } }).constraints.map(entry => entry.supported), [true, true]);
});

test('weapon constraints cannot silently interpret a spell recast offset', () => {
  const input = request();
  input.constraints = [damageConstraint({ turnOffset: 1 })];
  const result = evaluateBuild(catalog([weapon()]), input, { slots: { weapon: 1 } });
  assert.equal(result.constraints[0].supported, false);
  assert.equal(result.valid, false);
});
