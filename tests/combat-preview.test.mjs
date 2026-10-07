import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatePreviewSpellDamage, calculatePreviewWeaponDamage, createCombatPreviewContext, defaultCharacter,
  defaultCombatPreview, defaultTarget, getCombatPreviewBonuses, getPreviewBoosts, getPreviewPassives } from '../packages/shared/dist/index.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const character = defaultCharacter(9, 200);
const build = (...ids) => ({ slots: Object.fromEntries(ids.map((id, index) => [`dofus${index + 1}`, id])) });
const activate = (state, key, changes = {}) => { state.passives[key] = { enabled: true, ...changes }; };
const effect = (effectId, diceNum, extra = {}) => ({ effectId, diceNum, diceSide: 0, value: 0, ...extra });
const direct = { id: 42, name: 'Fixture Terre', description: '', classIds: [9], icon: '', levels: [{
  id: 1, grade: 1, minPlayerLevel: 1, apCost: 4, minRange: 1, range: 5, rangeCanBeBoosted: false,
  criticalHitProbability: 20, minCastInterval: 1, maxCastPerTurn: 1, maxCastPerTarget: 1,
  effects: [effect(97, 100)], criticalEffects: [effect(97, 120)],
}] };
const context = (equipment, stats = {}, state = defaultCombatPreview(), char = character, data = catalog) =>
  createCombatPreviewContext(data, equipment, char, stats, state);

test('native passive descriptions and effects are present without becoming permanent equipment bonuses', () => {
  for (const id of [694, 739, 6980, 8698, 7114, 23237, 29136]) {
    const item = catalog.items.find(item => item.id === id);
    assert.ok(item.passives[0].description.length > 0);
    assert.ok(item.passives[0].effects.length > 0);
  }
  assert.deepEqual(catalog.items.find(item => item.id === 694).stats, { damagePercent: 80 });
  assert.equal(catalog.items.find(item => item.id === 739).stats.criticalHit, 10);
});

test('only checked passives of currently equipped items apply, without doubling permanent stats', () => {
  const state = defaultCombatPreview(), permanent = { strength: 100, damagePercent: 80, criticalHit: 10 };
  activate(state, 'item:694:8395', { value: 10 });
  activate(state, 'item:739:5952', { value: 5 });
  activate(state, 'item:6980:8396');
  const result = context(build(694, 739, 6980), permanent, state);
  assert.equal(result.statsAtOffset[0].dealtDamageMultiplier, 25);
  assert.equal(result.statsAtOffset[0].damagePercent, 80);
  assert.equal(result.statsAtOffset[0].criticalHit, 10);
  assert.deepEqual(permanent, { strength: 100, damagePercent: 80, criticalHit: 10 });
  assert.equal(calculatePreviewSpellDamage(direct, character, defaultTarget(), result).normal.min, 350);
  assert.equal(context(build(694), permanent, state).bonuses.dealtDamageMultiplier, 10);
  assert.deepEqual(context(build(), permanent, state).bonuses, {});
  state.passives['item:694:8395'].enabled = false;
  assert.deepEqual(context(build(694), permanent, state).bonuses, {});
});

test('nebula alternates the damage of recasts by the actual combat turn', () => {
  const state = defaultCombatPreview(); activate(state, 'item:8698:5454');
  let result = calculatePreviewSpellDamage(direct, character, defaultTarget(), context(build(8698), {}, state));
  assert.equal(result.normal.min, 120);
  assert.deepEqual(result.turns.slice(0, 4).map(turn => turn.normal.min), [120, 90, 120, 90]);
  state.turn = 2;
  result = calculatePreviewSpellDamage(direct, character, defaultTarget(), context(build(8698), {}, state));
  assert.deepEqual(result.turns.slice(0, 4).map(turn => turn.normal.min), [90, 120, 90, 120]);
});

test('stack caps, remaining turns and defensive passives do not invent damage', () => {
  const state = defaultCombatPreview(); activate(state, 'item:694:8395', { value: 999, remainingTurns: 1 });
  activate(state, 'item:737:8393');
  const result = context(build(694, 737), {}, state);
  assert.equal(result.bonuses.dealtDamageMultiplier, 10);
  assert.equal(result.statsAtOffset[1].dealtDamageMultiplier ?? 0, 0);
  assert.equal(calculatePreviewSpellDamage(direct, character, defaultTarget(), result).turns[1].normal.min, 100);
});

test('native Tirs Puissants uses its real rank, critical cast and one-turn duration', () => {
  const state = defaultCombatPreview(); state.boosts['32466'] = { enabled: true };
  const punitive = catalog.spells.find(spell => spell.id === 32456);
  let result = calculatePreviewSpellDamage(punitive, character, defaultTarget(), context(build(), {}, state));
  assert.equal(result.normal.min, 105); // 30 base with 250 Power
  assert.equal(result.critical.min, 126);
  assert.equal(result.critChance, 35); // 20 base + 15 boost
  assert.equal(result.turns[1].normal.min, 54); // +24 charge, boost expired
  assert.equal(result.turns[1].critChance, 20);
  state.boosts['32466'].critical = true;
  result = calculatePreviewSpellDamage(punitive, character, defaultTarget(), context(build(), {}, state));
  assert.equal(result.normal.min, 120); // same normal attack with the critical boost's 300 Power
  assert.equal(result.critChance, 37);
  assert.equal(context(build(), {}, state, defaultCharacter(9, 34)).bonuses.damagePercent ?? 0, 0);
  state.boosts['32466'].age = 1;
  assert.equal(context(build(), {}, state).bonuses.damagePercent ?? 0, 0);
});

test('weapon skill affects only weapon damage and respects the boost cast mode', () => {
  const weapon = { id: 1, name: 'Fixture', level: 1, typeId: 6, typeName: 'Épée', category: 'Équipements', slotType: 'weapon', icon: '', stats: {},
    weapon: { apCost: 4, minRange: 1, range: 1, criticalHitProbability: 20, criticalHitBonus: 5, maxCastPerTurn: 1 }, effects: [effect(97, 10)] };
  const state = defaultCombatPreview(); state.boosts['3506'] = { enabled: true };
  let buffs = context(build(), {}, state);
  assert.equal(calculatePreviewWeaponDamage(weapon, character, defaultTarget(), buffs).normal.min, 40);
  assert.equal(calculatePreviewSpellDamage(direct, character, defaultTarget(), buffs).normal.min, 100);
  state.boosts['3506'].critical = true;
  buffs = context(build(), {}, state);
  assert.equal(calculatePreviewWeaponDamage(weapon, character, defaultTarget(), buffs).normal.min, 46);
  assert.equal(calculatePreviewWeaponDamage(weapon, character, defaultTarget(), buffs).critical.min, 69);
  state.boosts['3506'].age = 3;
  assert.equal(calculatePreviewWeaponDamage(weapon, character, defaultTarget(), context(build(), {}, state)).normal.min, 10);
});

test('Cauchemar includes its required power once and Domakuro preserves accumulated flat damage', () => {
  const state = defaultCombatPreview(); activate(state, 'item:26066:20981:eye');
  const equipment = build(26066, 23237);
  assert.equal(context(equipment, {}, state).bonuses.damagePercent, 100);
  activate(state, 'item:26066:20981:power');
  assert.equal(context(equipment, {}, state).bonuses.damagePercent, 100);
  activate(state, 'item:23237:17006', { value: 64 });
  assert.equal(context(equipment, {}, state).bonuses.allDamageBonus, 64);
  assert.equal(context(equipment, {}, state).statsAtOffset[12].allDamageBonus, 64);
});

test('Ebene distance and melee stacks are distinct and its poison is not added to the attack', () => {
  const state = defaultCombatPreview(); activate(state, 'item:7114:18629:0', { value: 5 });
  const equipment = build(7114), buffs = context(equipment, {}, state);
  assert.equal(calculatePreviewSpellDamage(direct, character, defaultTarget(), buffs).normal.min, 110);
  assert.equal(calculatePreviewSpellDamage(direct, character, { ...defaultTarget(), distance: 'melee' }, buffs).normal.min, 100);
  assert.ok(getPreviewPassives(catalog, equipment).every(entry => entry.status === 'partial' && entry.note.includes('poison')));
});

test('delayed boosts wait for their native delay; random and state-dependent branches are not guessed', () => {
  const spell = { ...direct, id: 43, levels: [{ ...direct.levels[0], effects: [effect(138, 200, { duration: 1, delay: 1, triggers: 'I', targetMask: 'C' })], criticalEffects: [] }] };
  const random = { ...spell, id: 44, levels: [{ ...spell.levels[0], effects: [effect(138, 200, { diceSide: 300, targetMask: 'C' })] }] };
  const conditional = { ...spell, id: 45, levels: [{ ...spell.levels[0], effects: [effect(138, 200, { targetMask: 'C,E125' })] }] };
  const data = { ...catalog, spells: [spell, random, conditional] }, state = defaultCombatPreview(); state.boosts['43'] = { enabled: true };
  assert.deepEqual(getPreviewBoosts(data, character).map(boost => boost.spell.id), [43]);
  assert.equal(getCombatPreviewBonuses(data, build(), character, state, 0).damagePercent ?? 0, 0);
  assert.equal(getCombatPreviewBonuses(data, build(), character, state, 1).damagePercent, 200);
  assert.equal(getCombatPreviewBonuses(data, build(), character, state, 2).damagePercent ?? 0, 0);
});

test('Dofusteuse rotates only its current characteristic and Prynyang ends after its three turns', () => {
  const dofusteuse = catalog.items.find(item => item.name === 'Dofusteuse');
  const prynyang = catalog.items.find(item => item.passives?.some(passive => passive.id === 14913));
  const state = defaultCombatPreview();
  activate(state, `item:${dofusteuse.id}:7331`); activate(state, `item:${prynyang.id}:14913`);
  const result = context({ slots: { cape: dofusteuse.id, dofus1: prynyang.id } }, {}, state);
  assert.deepEqual(result.statsAtOffset.slice(0, 5).map(stats => ['chance', 'strength', 'agility', 'intelligence'].map(key => stats[key] || 0)),
    [[400, 0, 0, 0], [0, 400, 0, 0], [0, 0, 400, 0], [0, 0, 0, 400], [400, 0, 0, 0]]);
  assert.deepEqual(result.statsAtOffset.slice(0, 4).map(stats => stats.dealtDamageMultiplier || 0), [10, 3, -10, 0]);
});

test('legendary final-damage stacks use native magnitudes without adding defensive branches', () => {
  const crown = catalog.items.find(item => item.passives?.some(passive => passive.id === 11360));
  const state = defaultCombatPreview(); activate(state, `item:${crown.id}:11360`, { value: 5 });
  const result = context({ slots: { hat: crown.id } }, {}, state);
  assert.equal(result.bonuses.dealtDamageMultiplier, 10);
  assert.equal(calculatePreviewSpellDamage(direct, character, defaultTarget(), result).normal.min, 110);
  assert.equal(result.statsAtOffset[2].dealtDamageMultiplier || 0, 0);
});
