import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWeaponMetadata, effectFightUsage, effectsForEquipmentStats } from '../scripts/equipment-metadata.mjs';

test('weapon normalization copies native attack metadata exactly, including zero values', () => {
  const native = { id: 18013, className: 'WeaponData', apCost: 4, minRange: 1, range: 1,
    criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 };
  assert.deepEqual(normalizeWeaponMetadata(native, 'weapon'), { apCost: 4, minRange: 1, range: 1,
    criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 });
  assert.deepEqual(normalizeWeaponMetadata({ ...native, apCost: 0, criticalHitProbability: 0, criticalHitBonus: 0, maxCastPerTurn: 0 }, 'weapon'),
    { apCost: 0, minRange: 1, range: 1, criticalHitProbability: 0, criticalHitBonus: 0, maxCastPerTurn: 0 });
  assert.equal(normalizeWeaponMetadata(native, 'hat'), undefined);
});
test('missing or malformed weapon metadata remains unsupported rather than guessed', () => {
  assert.equal(normalizeWeaponMetadata({ apCost: 4 }, 'weapon'), undefined);
  const native = { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 };
  for (const change of [{ apCost: '4' }, { criticalHitProbability: 101 }, { minRange: 3 }, { range: NaN }, { maxCastPerTurn: -1 }]) {
    assert.equal(normalizeWeaponMetadata({ ...native, ...change }, 'weapon'), undefined);
  }
});
test('weapon attacks removing target AP/MP do not become passive owner penalties', () => {
  // Native EffectData distinguishes combat-only removal (101/127) from equipment maluses (168/169).
  const definitions = new Map([[101, { useInFight: 1 }], [127, { useInFight: true }], [168, { useInFight: 0 }], [169, { useInFight: false }], [118, { useInFight: 0 }]]);
  const effects = [101, 127, 168, 169, 118].map(effectId => ({ effectId, diceNum: 1, diceSide: 0, value: 0 }));
  assert.deepEqual(effectsForEquipmentStats(effects, 'weapon', definitions).map(e => e.effectId), [168, 169, 118]);
  assert.deepEqual(effectsForEquipmentStats(effects, 'hat', definitions), effects);
  assert.equal(effectFightUsage({}), undefined); assert.equal(effectFightUsage({ useInFight: 'false' }), undefined);
});
test('packaged weapons carry complete metadata and attack classification from the native snapshot', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
  const weapons = catalog.items.filter(item => item.slotType === 'weapon');
  assert.ok(weapons.length > 700);
  for (const item of weapons) {
    assert.deepEqual(normalizeWeaponMetadata(item.weapon || {}, 'weapon'), item.weapon, `${item.id}: complete source metadata`);
    assert.ok(item.weapon, `${item.id}: weapon metadata absent`);
    assert.ok(item.effects.every(effect => typeof effect.isInFight === 'boolean' || effect.effectId === 205), `${item.id}: effect classification absent`);
  }
  assert.ok(catalog.items.filter(item => item.slotType !== 'weapon').every(item => item.weapon === undefined));
  const kaiser = catalog.items.find(item => item.id === 233);
  assert.equal(kaiser.effects.find(effect => effect.effectId === 101).isInFight, true);
  assert.equal(kaiser.stats.actionPoints || 0, 0, 'Kaiser removes target AP on attack, not owner AP on equip');
});
