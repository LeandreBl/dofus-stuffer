import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSpellDamage, defaultTarget, hasStatScalingSpellDamage } from '../packages/shared/dist/index.js';
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const native = name => { const spell = catalog.spells.find(spell => spell.name === name); assert.ok(spell, name); return spell; };
const effect = (effectId, extra = {}) => ({ effectId, diceNum: 10, diceSide: 12, value: 0, order: 0, targetMask: 'A', ...extra });
const fixture = (effects, extra = {}) => ({ id: 1, name: 'Test', classIds: [9], description: '', icon: '', levels: [{
  id: 1, grade: 1, minPlayerLevel: 1, apCost: 3, minRange: 1, range: 6, rangeCanBeBoosted: true,
  criticalHitProbability: 10, maxCastPerTurn: 1, maxCastPerTarget: 1, minCastInterval: 0, effects, criticalEffects: [],
}], ...extra });

test('damage objectives exclude native boosts and support while retaining damaging mixed spells', () => {
  for (const name of ['Tirs Puissants', 'Acuité Absolue', 'Sentinelle', 'Balise Tactique', 'Puissance', "Maîtrise d'Arme"])
    assert.equal(hasStatScalingSpellDamage(native(name), 200, catalog), false, name);
  for (const name of ['Flèche Punitive', 'Flèche Explosive', 'Flèche Assaillante', 'Attaque Mortelle'])
    assert.equal(hasStatScalingSpellDamage(native(name), 200, catalog), true, name);
});

test('available ranks, conditional effects and critical-only damage decide eligibility without a zero-damage preview filter', () => {
  assert.equal(hasStatScalingSpellDamage(native('Flèche Punitive'), 69, catalog), false);
  assert.equal(hasStatScalingSpellDamage(native('Flèche Punitive'), 70, catalog), true);
  const conditional = fixture([effect(97, { targetMask: 'A,*E2' })]);
  assert.equal(calculateSpellDamage(conditional, {}, defaultTarget(), 200).normal.max, 0);
  assert.equal(hasStatScalingSpellDamage(conditional), true);
  const critical = fixture([]);
  critical.levels[0].criticalEffects = [effect(99)];
  assert.equal(hasStatScalingSpellDamage(critical), true);
  const changing = fixture([effect(138)]);
  changing.levels.push({ ...changing.levels[0], id: 2, grade: 2, minPlayerLevel: 50, effects: [effect(99)] });
  assert.equal(hasStatScalingSpellDamage(changing, 49), false);
  assert.equal(hasStatScalingSpellDamage(changing, 50), true);
});

test('pure fixed, target-life and reflected damage are excluded; player life and push damage scale with stats', () => {
  for (const id of [82, 144, 1048, 1063, 1067, 1092, 1118, 1124, 1223, 1224, 141])
    assert.equal(hasStatScalingSpellDamage(fixture([effect(id)])), false, String(id));
  for (const id of [85, 89, 275, 279, 5, 783, 1012, 1131, 2822, 2832])
    assert.equal(hasStatScalingSpellDamage(fixture([effect(id)])), true, String(id));
  assert.equal(hasStatScalingSpellDamage(fixture([effect(1041)])), false, 'Self recoil is not outgoing push damage.');
  assert.equal(hasStatScalingSpellDamage(fixture([effect(99, { targetMask: 'C' }), effect(138)])), false);
  assert.equal(hasStatScalingSpellDamage(fixture([effect(99, { clientOnly: true })])), false);
});

test('native traps, poisons and rune detonations keep their damage objectives; rune creation alone does not', () => {
  for (const name of ['Piège Sournois', 'Épidémie', 'Surcharge Runique'])
    assert.equal(hasStatScalingSpellDamage(native(name), 200, catalog), true, name);
  const internal = { ...fixture([effect(97)]), id: 2 };
  const data = { ...catalog, combatSpells: [internal], spells: [] };
  assert.equal(hasStatScalingSpellDamage(fixture([effect(2022, { diceNum: 2 })]), 200, data), false);
  assert.equal(hasStatScalingSpellDamage(fixture([effect(400, { diceNum: 2, diceSide: 1, targetMask: 'C' })]), 200, data), true);
});

test('summon attacks qualify only through inherited characteristics that affect their damage', () => {
  assert.equal(hasStatScalingSpellDamage(native('Tofu'), 200, catalog), true);
  const internal = { ...fixture([effect(99)]), id: 2 };
  const summonSpell = fixture([effect(181, { diceNum: 10, diceSide: 1 })]);
  const data = { ...catalog, spells: [], combatSpells: [internal], summons: [{ id: 10, name: 'Test', spells: [2],
    grades: [{ grade: 1, level: 200, stats: { intelligence: 100 }, inheritedStats: { wisdom: 50 } }] }] };
  assert.equal(hasStatScalingSpellDamage(summonSpell, 200, data), false);
  data.summons[0].grades[0].inheritedStats = { intelligence: 50 };
  assert.equal(hasStatScalingSpellDamage(summonSpell, 200, data), true);
});

test('recursive utility dependencies terminate and are not mistaken for damage', () => {
  const first = fixture([effect(400, { diceNum: 2, diceSide: 1 })]);
  const second = { ...fixture([effect(400, { diceNum: 1, diceSide: 1 })]), id: 2 };
  const data = { ...catalog, spells: [first], combatSpells: [second] };
  assert.equal(hasStatScalingSpellDamage(first, 200, data), false);
});
