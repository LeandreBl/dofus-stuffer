import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCharacterStats, calculateSpellCriticalChance, calculateSpellDamage, characterPointCost, defaultCharacter, defaultTarget, evaluateBuild, getCharacterAllocation } from '../packages/shared/dist/index.js';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const request = () => ({ character: defaultCharacter(), constraints: [], target: defaultTarget(), filters: { excludedItemIds: [], excludedTypeIds: [], excludedCategories: [], lockedSlots: {} }, prices: { server: 'Draconiros', values: {}, ownedItemIds: [], mode: 'total' }, seconds: 3 });
const directSpell = { id: 1, name: 'Fixture de test', classIds: [9], icon: '', description: '', levels: [{ id: 1, grade: 1, minPlayerLevel: 1, apCost: 4, minRange: 1, range: 8, rangeCanBeBoosted: true, criticalHitProbability: 20, maxCastPerTurn: 1, maxCastPerTarget: 1, minCastInterval: 0, effects: [{ effectId: 97, diceNum: 10, diceSide: 12, value: 0 }], criticalEffects: [{ effectId: 97, diceNum: 13, diceSide: 15, value: 0 }] }] };

test('an explicitly empty allowed-item list forbids equipped items in front and worker alike', () => {
  const item = { id: 1, name: 'Fixture', level: 1, typeId: 1, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', stats: {}, icon: '' };
  const input = request();
  input.filters.allowedItemIds = [];
  assert.equal(evaluateBuild({ ...catalog, items: [item] }, input, { slots: { hat: 1 } }).valid, false);
  assert.equal(evaluateBuild({ ...catalog, items: [item] }, input, { slots: {} }).valid, true);
});

test('direct elemental damage distinguishes critical damage from critical probability', () => {
  const damage = calculateSpellDamage(directSpell, { strength: 100, allDamageBonus: 5, criticalDamageBonus: 10, criticalHit: 30 });
  assert.deepEqual(damage.normal, { min: 25, average: 27, max: 29 });
  assert.deepEqual(damage.critical, { min: 41, average: 43, max: 45 });
  assert.equal(damage.critChance, 50);
  assert.equal(damage.expected, 35);
  assert.equal(damage.perAp, 8.75);
  assert.equal(damage.supported, true);
});

test('fixed and critical resistance apply per line before percentage resistance', () => {
  const target = { ...defaultTarget(), flat: { earth: 5 }, percent: { earth: 20 }, criticalResistance: 10 };
  const damage = calculateSpellDamage(directSpell, { strength: 100, allDamageBonus: 5, criticalDamageBonus: 10 }, target);
  assert.equal(damage.normal.min, 16);
  assert.equal(damage.critical.min, 20);
});

test('spell critical chance uses the available rank and clamps equipment bonuses independently from damage', () => {
  const spell = structuredClone(directSpell);
  spell.levels.push({ ...spell.levels[0], id: 2, grade: 2, minPlayerLevel: 150, criticalHitProbability: 30 });
  assert.equal(calculateSpellCriticalChance(spell, { criticalHit: 35 }, 100), 55);
  assert.equal(calculateSpellCriticalChance(spell, { criticalHit: 35, criticalDamageBonus: 900, agility: 900 }, 200), 65);
  assert.equal(calculateSpellCriticalChance(spell, { criticalHit: 200 }), 100);
  assert.equal(calculateSpellCriticalChance(spell, { criticalHit: -200 }), 0);
  spell.levels.forEach(level => { level.criticalHitProbability = 0; });
  assert.equal(calculateSpellCriticalChance(spell, { criticalHit: 100 }), 0);
  assert.equal(calculateSpellDamage(spell, { criticalHit: 100 }).critChance, 0);
});

test('damage and critical-chance thresholds coexist for the same spell with independent priorities', () => {
  const item = { id: 1, name: 'Coiffe de test', level: 1, typeId: 16, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', icon: '', stats: { criticalHit: 30, criticalDamageBonus: 50 } };
  const data = { ...catalog, items: [item], sets: [], spells: [directSpell] };
  const input = request();
  input.constraints = [
    { id: 'damage', kind: 'spell', spellId: 1, target: 63, relation: 'atLeast', priority: 1, strict: true, mode: 'critical', metric: 'min' },
    { id: 'crit-rate', kind: 'spell', spellId: 1, target: 50, relation: 'atLeast', priority: 0, strict: true, metric: 'criticalChance' },
  ];
  const result = evaluateBuild(data, input, { slots: { hat: 1 } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.constraints.map(entry => [entry.value, entry.satisfied]), [[63, true], [50, true]]);
  input.constraints[1].target = 51;
  const missed = evaluateBuild(data, input, { slots: { hat: 1 } });
  assert.equal(missed.valid, false);
  assert.equal(missed.constraints[0].satisfied, true);
  assert.equal(missed.constraints[1].satisfied, false);
});

test('critical chance is available for support spells and does not require supported direct damage', () => {
  const support = structuredClone(directSpell);
  support.levels[0].effects = [{ effectId: 108, diceNum: 10, diceSide: 20, value: 0 }];
  support.levels[0].criticalEffects = [{ effectId: 108, diceNum: 20, diceSide: 30, value: 0 }];
  const preview = calculateSpellDamage(support, { criticalHit: 30 });
  assert.equal(preview.supported, false);
  assert.equal(preview.critChance, 50);
  const input = request();
  input.constraints = [{ id: 'crit-rate', kind: 'spell', spellId: 1, target: 20, relation: 'atLeast', priority: 0, strict: true, metric: 'criticalChance' }];
  const evaluation = evaluateBuild({ ...catalog, spells: [support] }, input, { slots: {} });
  assert.equal(evaluation.valid, true);
  assert.equal(evaluation.constraints[0].value, 20);
  assert.equal(evaluation.constraints[0].supported, true);
});

test('a critical-chance threshold cannot certify unavailable, wrong-class, unverified or non-critical spells', () => {
  const input = request();
  input.constraints = [{ id: 'crit-rate', kind: 'spell', spellId: 1, target: 1, relation: 'atLeast', priority: 0, strict: true, metric: 'criticalChance' }];
  for (const scenario of ['unavailable', 'class', 'data', 'non-critical']) {
    const spell = structuredClone(directSpell);
    if (scenario === 'unavailable') spell.levels[0].minPlayerLevel = 201;
    if (scenario === 'class') spell.classIds = [1];
    if (scenario === 'data') spell.dataWarnings = ['Données non vérifiées.'];
    if (scenario === 'non-critical') spell.levels[0].criticalHitProbability = 0;
    const evaluation = evaluateBuild({ ...catalog, spells: [spell] }, input, { slots: {} });
    assert.equal(evaluation.valid, false, scenario);
    assert.equal(evaluation.constraints[0].satisfied, false, scenario);
    assert.equal(evaluation.constraints[0].supported, scenario === 'non-critical', scenario);
    if (scenario === 'unavailable') assert.equal(calculateSpellCriticalChance(spell, {}), null);
  }
});

test('critical-chance priorities can share a rank and remain independent from damage rankings', () => {
  const input = request();
  input.constraints = [
    { id: 'crit-rate', kind: 'spell', spellId: 1, target: 40, relation: 'atLeast', priority: 0, strict: false, metric: 'criticalChance' },
    { id: 'damage', kind: 'spell', spellId: 1, target: 13, relation: 'atLeast', priority: 0, strict: false, mode: 'critical', metric: 'min' },
  ];
  const data = { ...catalog, spells: [directSpell] };
  assert.equal(evaluateBuild(data, input, { slots: {} }).score, 75);
  input.constraints[1].priority = 1;
  assert.ok(Math.abs(evaluateBuild(data, input, { slots: {} }).score - 200 / 3) < 1e-9);
});

test('Punitive uses the actual imported level and recasts every turn within its stack limit', () => {
  const punitive = catalog.spells.find(spell => spell.id === 32456);
  assert.ok(punitive);
  const damage = calculateSpellDamage(punitive, {}, defaultTarget(), 200);
  assert.deepEqual([damage.normal.min, damage.normal.max], [30, 34]);
  assert.deepEqual([damage.critical.min, damage.critical.max], [36, 41]);
  assert.equal(damage.turns.find(turn => turn.turn === 1).bonus, 24);
  assert.equal(damage.turns.find(turn => turn.turn === 1).normal.min, 54);
  assert.equal(damage.turns.find(turn => turn.turn === 2).normal.min, 54); // maxStack 1: T1's +24 replaces T0's +32
  assert.equal(damage.turns.find(turn => turn.turn === 3).normal.min, 54);
  assert.equal(calculateSpellDamage(punitive, {}, defaultTarget(), 69).supported, false);
});

test('Expiation stacks the delayed bonuses of every earlier recast', () => {
  const expiation = catalog.spells.find(spell => spell.id === 32438);
  const turns = calculateSpellDamage(expiation, {}, defaultTarget(), 200).turns;
  assert.deepEqual(turns.filter(turn => turn.available).map(turn => turn.bonus), [0, 36, 72, 72]);
});

test('conditional or unimplemented damage cannot satisfy a strict spell constraint', () => {
  const conditional = structuredClone(directSpell);
  conditional.levels[0].effects[0].triggers = 'TP';
  const data = { ...catalog, spells: [conditional] };
  const input = request();
  input.constraints = [{ id: 'threshold', kind: 'spell', spellId: 1, target: 1, relation: 'atLeast', priority: 0, strict: true, mode: 'normal' }];
  const result = evaluateBuild(data, input, { slots: {} });
  assert.equal(result.valid, false);
  assert.equal(result.constraints[0].supported, false);
});

test('fixed neutral damage and stat-changing effects are never silently certified', () => {
  for (const effectId of [144, 118, 215, 266, 418]) {
    const spell = structuredClone(directSpell);
    spell.levels[0].effects.push({ effectId, diceNum: 10, diceSide: 0, value: 0 });
    const result = calculateSpellDamage(spell, {});
    assert.equal(result.supported, false, `effect ${effectId}`);
    assert.ok(result.warnings.length);
  }
});

test('AP removal and healing reduction do not invalidate immediate damage previews', () => {
  for (const effectId of [1079, 1159]) {
    const spell = structuredClone(directSpell);
    spell.levels[0].effects.push({ effectId, diceNum: 2, diceSide: 0, value: 0 });
    const result = calculateSpellDamage(spell, {});
    assert.equal(result.supported, true, `effect ${effectId}`);
    assert.ok(result.normal.min > 0);
  }
});

test('set bonus uses the attained tier, never the sum of preceding tiers', () => {
  const items = ['hat', 'cape', 'boots'].map((slotType, i) => ({ id: i + 1, name: slotType, level: 1, typeId: 1, typeName: slotType, category: 'Équipements', slotType, stats: {}, icon: '', setId: 99 }));
  const data = { ...catalog, items, sets: [{ id: 99, name: 'Test', bonuses: [{ count: 2, stats: { strength: 10 } }, { count: 3, stats: { strength: 25 } }] }] };
  const result = evaluateBuild(data, request(), { slots: { hat: 1, cape: 2, boots: 3 } });
  assert.equal(result.stats.strength, 25);
  assert.equal(result.stats.setBonus, 2);
});

test('equipment rules allow two non-set rings but only one prysmaradite', () => {
  const base = { name: 'Fixture', level: 1, typeName: 'Fixture', category: 'Équipements', stats: { strength: 10 }, icon: '' };
  const data = { ...catalog, items: [
    { ...base, id: 1, typeId: 9, slotType: 'ring' },
    { ...base, id: 2, typeId: 9, slotType: 'ring', setId: 10 },
    { ...base, id: 3, typeId: 217, slotType: 'dofus' },
    { ...base, id: 4, typeId: 217, slotType: 'dofus' },
  ], sets: [] };
  const rings = evaluateBuild(data, request(), { slots: { ring1: 1, ring2: 1 } });
  assert.equal(rings.valid, true);
  assert.equal(rings.stats.strength, 20);
  assert.equal(evaluateBuild(data, request(), { slots: { ring1: 2, ring2: 2 } }).valid, false);
  assert.equal(evaluateBuild(data, request(), { slots: { dofus1: 3, dofus2: 4 } }).valid, false);
});

test('an unknown price is never zero and owned equipment changes only remaining purchase cost', () => {
  const item = catalog.items.find(entry => entry.slotType === 'hat' && !entry.conditions);
  const input = request();
  input.constraints = [{ id: 'budget', kind: 'price', target: 100000, relation: 'atMost', priority: 0, strict: true }];
  const build = { slots: { hat: item.id } };
  assert.equal(evaluateBuild(catalog, input, build).cost, null);
  assert.equal(evaluateBuild(catalog, input, build).valid, false);
  input.prices.values[item.id] = 50000;
  assert.equal(evaluateBuild(catalog, input, build).cost, 50000);
  input.prices.ownedItemIds = [item.id];
  input.prices.mode = 'remaining';
  assert.equal(evaluateBuild(catalog, input, build).cost, 0);
});

test('the imported selectable catalog covers each class and contains no placeholder spells', () => {
  assert.ok(catalog.stats.length >= 100);
  assert.ok(catalog.spells.length >= 800);
  assert.ok(catalog.items.length >= 3000);
  for (const breed of catalog.classes) assert.ok(catalog.spells.some(spell => spell.classIds.includes(breed.id)), breed.name);
  for (const spell of catalog.spells) {
    assert.ok(spell.name && spell.levels.length);
    assert.ok(spell.icon.startsWith('/game/'));
  }
});

test('character levels grant a real point budget and scrolling never advances the invested tiers', () => {
  for (const [value, cost] of [[100, 100], [101, 102], [200, 300], [201, 303], [300, 600], [301, 604], [398, 992]]) {
    assert.equal(characterPointCost('strength', value), cost);
  }
  assert.equal(characterPointCost('vitality', 300), 300);
  assert.equal(characterPointCost('wisdom', 100), 300);
  const character = { ...defaultCharacter(), baseStats: { strength: 398 }, scrollStats: { strength: 100 } };
  assert.deepEqual(getCharacterAllocation(character), { available: 995, spent: 992, remaining: 3, valid: true, violations: [] });
  assert.equal(getCharacterAllocation({ ...character, level: 100 }).valid, false);
  assert.equal(getCharacterAllocation({ ...character, scrollStats: { strength: 101 } }).valid, false);
  assert.equal(getCharacterAllocation({ ...defaultCharacter(9, 1), scrollStats: { strength: 100 } }).valid, true);
});

test('automatic allocation spends the real level budget independently from scrolls and respects affordable minima', () => {
  const character = { ...defaultCharacter(), scrollStats: { strength: 100, wisdom: 100 } };
  const earth = allocateCharacterStats(character, { strength: 1 });
  assert.deepEqual(earth, { strength: 398, vitality: 3 });
  for (const level of [1, 50, 100, 199, 200]) {
    const stats = allocateCharacterStats({ ...character, level }, { strength: 2, vitality: 0.2, wisdom: 0.5 });
    const allocation = getCharacterAllocation({ ...character, level, baseStats: stats });
    assert.equal(allocation.valid, true);
    assert.equal(allocation.remaining, 0);
  }
  const required = allocateCharacterStats(character, { vitality: 1 }, { intelligence: 250, chance: 100 });
  assert.equal(required.intelligence, 250);
  assert.equal(required.chance, 100);
  assert.equal(required.vitality, 445);
  assert.equal(getCharacterAllocation({ ...character, baseStats: required }).spent, 995);
});

test('each automatic candidate carries its own base allocation, while manual allocation stays fixed', () => {
  const input = request();
  input.character.scrollStats = { strength: 100 };
  const data = { ...catalog, items: [], sets: [] };
  const build = { slots: {}, baseStats: { strength: 398, vitality: 3 } };
  const result = evaluateBuild(data, input, build);
  assert.equal(result.stats.strength, 498);
  assert.equal(result.breakdown.strength.base, 398);
  assert.equal(result.characterPoints.remaining, 0);
  assert.deepEqual(result.build.baseStats, build.baseStats);
  assert.equal(evaluateBuild(data, input, { ...build, baseStats: { strength: 400 } }).valid, false);
  input.character.allocationMode = 'manual';
  input.character.baseStats = { vitality: 995 };
  const manual = evaluateBuild(data, input, build);
  assert.equal(manual.stats.strength, 100);
  assert.equal(manual.stats.vitality, 995);
});

test('surplus PA PM PO can be equipped but never satisfies an impossible effective-stat objective', () => {
  const item = { id: 1, name: 'Fixture', level: 1, typeId: 1, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', stats: { actionPoints: 7, movementPoints: 5, range: 8 }, icon: '' };
  const data = { ...catalog, items: [item], sets: [] };
  const input = request();
  const result = evaluateBuild(data, input, { slots: { hat: 1 } });
  assert.equal(result.valid, true);
  assert.deepEqual([result.stats.actionPoints, result.stats.movementPoints, result.stats.range], [12, 6, 6]);
  assert.equal(result.breakdown.actionPoints.derived, -2);
  assert.equal(result.warnings.length, 3);
  input.constraints = [{ id: 'pa13', kind: 'stat', statKey: 'actionPoints', relation: 'atLeast', target: 13, strict: true, priority: 0 }];
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 } }).valid, false);
});

test('elemental percentage resistance caps affect display and scoring while fixed resistance and monsters remain separate', () => {
  const keys = ['earth', 'fire', 'water', 'air', 'neutral'].map(element => `${element}ElementResistPercent`);
  const item = { id: 1, name: 'Fixture résistances', level: 1, typeId: 1, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', icon: '', stats: { ...Object.fromEntries(keys.map(key => [key, 80])), earthElementReduction: 90, criticalDamageReduction: 85 } };
  const input = request();
  input.constraints = keys.map(key => ({ id: key, kind: 'stat', statKey: key, relation: 'maximize', target: 50, strict: false, priority: 0 }));
  const data = { ...catalog, items: [item], sets: [] };
  const result = evaluateBuild(data, input, { slots: { hat: 1 } });
  assert.equal(result.valid, true);
  for (const key of keys) {
    assert.equal(result.stats[key], 50);
    assert.equal(result.breakdown[key].equipment, 80);
    assert.equal(result.breakdown[key].derived, -30);
    assert.equal(result.constraints.find(entry => entry.id === key).value, 50);
  }
  const exactlyCapped = { ...data, items: [{ ...item, stats: { ...item.stats, ...Object.fromEntries(keys.map(key => [key, 50])) } }] };
  assert.equal(result.score, evaluateBuild(exactlyCapped, input, { slots: { hat: 1 } }).score);
  assert.equal(result.stats.earthElementReduction, 90);
  assert.equal(result.stats.criticalDamageReduction, 85);
  const negative = { ...data, items: [{ ...item, stats: { earthElementResistPercent: -20 } }] };
  assert.equal(evaluateBuild(negative, input, { slots: { hat: 1 } }).stats.earthElementResistPercent, -20);
  input.constraints[0] = { ...input.constraints[0], relation: 'atLeast', target: 51, strict: true };
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 } }).valid, false);
  const target = { ...defaultTarget(), percent: { earth: 75 } };
  assert.equal(calculateSpellDamage(directSpell, { strength: 900 }, target).normal.min, 25);
});

test('automatic prices update estimates while manual zero overrides and ownership remain authoritative', () => {
  const item = { id: 1, name: 'Fixture prix', level: 1, typeId: 1, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', icon: '', stats: {} };
  const data = { ...catalog, items: [item], sets: [] };
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.prices.automaticValues = { 1: 500 };
  input.prices.automaticExoCosts = { actionPoints: 1000 };
  const build = { slots: { hat: 1 }, exoBonuses: ['actionPoints'] };
  assert.equal(evaluateBuild(data, input, build).cost, 1500);
  input.prices.automaticValues[1] = 700;
  assert.equal(evaluateBuild(data, input, build).cost, 1700);
  input.prices.values[1] = 0;
  input.prices.exoCosts = { actionPoints: 10 };
  assert.equal(evaluateBuild(data, input, build).cost, 10);
  input.prices.mode = 'remaining';
  input.prices.ownedExos = ['actionPoints'];
  assert.equal(evaluateBuild(data, input, build).cost, 0);
});

test('global exotic bonuses contribute once without assigning or changing any equipment', () => {
  const items = ['hat', 'cape'].map((slotType, i) => ({ id: i + 1, name: slotType, level: 1, typeId: 1, typeName: slotType, category: 'Équipements', slotType, stats: {}, icon: '', forgeable: true }));
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.prices.values = { 1: 200, 2: 300 };
  input.prices.exoCosts = { actionPoints: 400, movementPoints: 500 };
  const data = { ...catalog, items, sets: [] };
  const build = { slots: { hat: 1, cape: 2 }, exoBonuses: ['actionPoints', 'movementPoints'] };
  const result = evaluateBuild(data, input, build);
  assert.equal(result.valid, true);
  assert.equal(result.stats.actionPoints, 8);
  assert.equal(result.stats.movementPoints, 4);
  assert.equal(result.cost, 1400);
  assert.deepEqual(result.build.slots, build.slots);
  assert.deepEqual(result.build.exoBonuses, build.exoBonuses);
  assert.equal(Object.hasOwn(result.build, 'exos'), false);
  const duplicate = evaluateBuild(data, input, { ...build, exoBonuses: ['actionPoints', 'actionPoints'] });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.stats.actionPoints, 8);
  input.filters.allowedExos = ['actionPoints'];
  assert.equal(evaluateBuild(data, input, build).valid, false);
});

test('stat breakdown keeps power out of real stats, secondary stats and equipment prerequisites', () => {
  const item = { id: 1, name: 'Fixture', level: 1, typeId: 16, typeName: 'Chapeau', category: 'Équipements', slotType: 'hat', icon: '', stats: { strength: 80, damagePercent: 120, healBonus: 10 } };
  const data = { ...catalog, items: [item], sets: [] };
  const input = request();
  input.character.baseStats = { strength: 200, chance: 100, agility: 100, wisdom: 50, vitality: 100 };
  input.character.scrollStats = { strength: 100, chance: 100, agility: 100, wisdom: 100, vitality: 100 };
  const result = evaluateBuild(data, input, { slots: { hat: 1 } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.breakdown.strength, { base: 200, scroll: 100, equipment: 80, derived: 0, power: 120, total: 380 });
  assert.equal(result.stats.magicFind, 120);
  assert.equal(result.stats.initiative, 780);
  assert.equal(result.stats.tackleBlock, 20);
  assert.equal(result.stats.apReduction, 15);
  assert.equal(result.stats.healBonus, 10);
  assert.equal(result.stats.hitPoints, 1250);
  assert.equal(result.breakdown.hitPoints.base, 1150);
  assert.equal(result.breakdown.hitPoints.scroll, 100);
  const withPower = calculateSpellDamage(directSpell, result.stats);
  const withoutPower = calculateSpellDamage(directSpell, { ...result.stats, damagePercent: 0 });
  assert.equal(withPower.normal.min - withoutPower.normal.min, 12);
  data.items[0] = { ...item, conditions: { kind: 'stat', stat: 'strength', operator: '>', value: 400 } };
  assert.equal(evaluateBuild({ ...data }, input, { slots: { hat: 1 } }).valid, false);
});

test('the global exo maximum is a ceiling independent of allowed types and natural equipment AP or MP', () => {
  const item = { id: 1, name: 'Fixture PA PM', level: 1, typeId: 1, typeName: 'Coiffe', category: 'Équipements', slotType: 'hat', stats: { actionPoints: 1, movementPoints: 1 }, icon: '' };
  const data = { ...catalog, items: [item], sets: [] };
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  for (const maxExos of [0, 1, 2]) {
    input.filters.maxExos = maxExos;
    for (const exoBonuses of [[], ['actionPoints'], ['movementPoints'], ['actionPoints', 'movementPoints']]) {
      const result = evaluateBuild(data, input, { slots: { hat: 1 }, exoBonuses });
      assert.equal(result.valid, exoBonuses.length <= maxExos, `max ${maxExos}, bonuses ${exoBonuses}`);
      // A build over the search limit is still displayed accurately for correction.
      assert.equal(result.stats.actionPoints, 8 + Number(exoBonuses.includes('actionPoints')));
      assert.equal(result.stats.movementPoints, 4 + Number(exoBonuses.includes('movementPoints')));
      assert.equal(result.violations.some(message => message.includes('maximum autorisé')), exoBonuses.length > maxExos);
    }
  }
  delete input.filters.maxExos;
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 }, exoBonuses: ['actionPoints', 'movementPoints'] }).valid, true);
  input.filters.allowedExos = ['movementPoints'];
  assert.equal(evaluateBuild(data, input, { slots: { hat: 1 }, exoBonuses: ['actionPoints'] }).valid, false);
});

test('owned exotic bonuses still count toward the limit even when their remaining cost is zero', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.filters.maxExos = 1;
  input.prices.mode = 'remaining';
  input.prices.ownedExos = ['actionPoints', 'movementPoints'];
  const result = evaluateBuild(catalog, input, { slots: {}, exoBonuses: ['actionPoints', 'movementPoints'] });
  assert.equal(result.cost, 0);
  assert.equal(result.valid, false);
});

test('3.7 trophies accept one full set but reject two active sets', () => {
  const trophy = catalog.items.find(item => item.name === 'Remueur');
  assert.equal(trophy.conditions.stat, 'activeSetCount');
  assert.equal(trophy.conditions.value, 2);
  const slots = ['hat', 'cape', 'boots', 'belt', 'amulet'];
  const items = slots.map((slotType, position) => ({ id: position + 1, name: slotType, level: 1, typeId: 1, typeName: slotType, category: 'Équipements', slotType, stats: {}, icon: '', setId: position < 3 ? 99 : 100 }));
  const data = { ...catalog, items: [...items, trophy], sets: [{ id: 99, name: 'A', bonuses: [] }, { id: 100, name: 'B', bonuses: [] }] };
  const one = evaluateBuild(data, request(), { slots: { hat: 1, cape: 2, boots: 3, dofus1: trophy.id } });
  assert.equal(one.stats.activeSetCount, 1);
  assert.equal(one.stats.setBonusCount, 2);
  assert.equal(one.valid, true);
  const two = evaluateBuild(data, request(), { slots: { hat: 1, cape: 2, boots: 3, belt: 4, amulet: 5, dofus1: trophy.id } });
  assert.equal(two.stats.activeSetCount, 2);
  assert.equal(two.valid, false);
});

test('global exo estimates are extra costs independent from ordinary item ownership', () => {
  const gelano = catalog.items.find(item => item.name === 'Gelano');
  const input = request();
  input.filters.allowedExos = ['movementPoints'];
  input.prices.mode = 'remaining';
  input.prices.ownedItemIds = [gelano.id];
  input.prices.values[gelano.id] = 10000;
  const build = { slots: { ring1: gelano.id }, exoBonuses: ['movementPoints'] };
  const missing = evaluateBuild(catalog, input, build);
  assert.equal(missing.stats.actionPoints, 8);
  assert.equal(missing.stats.movementPoints, 4);
  assert.equal(missing.cost, null);
  assert.deepEqual(missing.missingExoPrices, ['pm']);
  assert.deepEqual(missing.missingPrices, []);
  input.prices.exoCosts = { movementPoints: 1000000 };
  assert.equal(evaluateBuild(catalog, input, build).cost, 1000000);
  input.prices.ownedExos = ['movementPoints'];
  assert.equal(evaluateBuild(catalog, input, build).cost, 0);
  input.prices.mode = 'total';
  assert.equal(evaluateBuild(catalog, input, build).cost, 1010000);
});

test('unknown global exo cost cannot satisfy a strict budget but an explicit zero estimate can', () => {
  const input = request();
  input.filters.allowedExos = ['actionPoints'];
  input.constraints = [{ id: 'budget', kind: 'price', target: 1000000, relation: 'atMost', priority: 0, strict: true }];
  const build = { slots: {}, exoBonuses: ['actionPoints'] };
  const missing = evaluateBuild(catalog, input, build);
  assert.equal(missing.valid, false);
  assert.equal(missing.cost, null);
  assert.equal(missing.constraints[0].supported, false);
  input.prices.exoCosts = { actionPoints: 0 };
  const priced = evaluateBuild(catalog, input, build);
  assert.equal(priced.cost, 0);
  assert.equal(priced.valid, true);
});

test('unverified patch data never certifies equipment or a spell threshold', () => {
  const spell = { ...directSpell, dataWarnings: ['Données 3.7 à vérifier.'] };
  assert.equal(calculateSpellDamage(spell, {}).supported, false);
  const item = { id: 1, name: 'Fixture', level: 1, typeId: 16, typeName: 'Chapeau', category: 'Équipements', slotType: 'hat', icon: '', stats: {}, dataWarnings: ['Données 3.7 à vérifier.'] };
  const result = evaluateBuild({ ...catalog, items: [item], sets: [] }, request(), { slots: { hat: 1 } });
  assert.equal(result.valid, false);
  assert.ok(result.warnings.some(warning => warning.includes('3.7')));
});

test('known price subtotal remains distinct from a missing total and counts every equipped copy', () => {
  const ring = { id: 1, name: 'Anneau test', level: 1, typeId: 9, typeName: 'Anneau', category: 'Équipements', slotType: 'ring', icon: '', stats: {} };
  const cape = { ...ring, id: 2, name: 'Cape test', slotType: 'cape' };
  const input = request();
  input.filters.allowedExos = ['actionPoints', 'movementPoints'];
  input.prices.automaticValues = { 1: 500 };
  input.prices.values = { 1: 200 };
  input.prices.exoCosts = { actionPoints: 1000 };
  input.constraints = [{ id: 'budget', kind: 'price', target: 2000, relation: 'atMost', priority: 0, strict: true }];
  const data = { ...catalog, items: [ring, cape], sets: [] };
  const build = { slots: { ring1: 1, ring2: 1, cape: 2 }, exoBonuses: ['actionPoints', 'movementPoints'] };
  const partial = evaluateBuild(data, input, build);
  assert.equal(partial.cost, null);
  assert.equal(partial.knownCost, 1400);
  assert.deepEqual(partial.missingPrices, [2]);
  assert.deepEqual(partial.missingExoPrices, ['pm']);
  assert.equal(partial.constraints[0].satisfied, false);
  input.prices.values[2] = 0;
  input.prices.exoCosts.movementPoints = 0;
  const full = evaluateBuild(data, input, build);
  assert.equal(full.cost, 1400);
  assert.equal(full.knownCost, 1400);
  input.prices.mode = 'remaining';
  input.prices.ownedItemIds = [1];
  input.prices.ownedExos = ['actionPoints'];
  const remaining = evaluateBuild(data, input, build);
  assert.equal(remaining.cost, 0);
  assert.equal(remaining.knownCost, 0);
});
