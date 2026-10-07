export * from './types.js';
export * from './character.js';
export * from './equipment-diagnostics.js';
export * from './weapon-damage.js';
export * from './combat-preview.js';
export * from './equipment-maluses.js';
export * from './equipment-price.js';
import { calculateEquipmentPrice } from './equipment-price.js';
import { calculateEquipmentMaluses } from './equipment-maluses.js';
import { getCharacterAllocation } from './character.js';
import { calculateWeaponCriticalChance, calculateWeaponDamage } from './weapon-damage.js';
import { formatItemCondition } from './equipment-diagnostics.js';
import { calculateNativeSpellDamage, type SpellCalculationContext } from './spell-damage.js';
export * from './spell-damage.js';
import type { Build, BuildEvaluation, Catalog, Character, CombatTarget, Constraint, DamageRange, Element, EquipmentItem, ItemCondition, OptimizationRequest, RawEffect, Slot, SlotType, Spell, SpellDamage, SpellLevel, Stats, WeaponDamage } from './types.js';

export const SLOTS: Slot[] = ['amulet', 'ring1', 'ring2', 'hat', 'cape', 'belt', 'boots', 'weapon', 'shield', 'pet', 'dofus1', 'dofus2', 'dofus3', 'dofus4', 'dofus5', 'dofus6'];
export const ELEMENTS: Element[] = ['neutral', 'earth', 'fire', 'water', 'air'];
/** Effective player characteristics outside combat; monster targets use their own resistances. */
export const STAT_CAPS: Readonly<Record<string, number>> = Object.freeze({
  actionPoints: 12, movementPoints: 6, range: 6,
  earthElementResistPercent: 50, fireElementResistPercent: 50,
  waterElementResistPercent: 50, airElementResistPercent: 50, neutralElementResistPercent: 50,
});
export function slotType(slot: Slot): SlotType { return slot.startsWith('ring') ? 'ring' : slot.startsWith('dofus') ? 'dofus' : slot as SlotType; }
export function defaultCharacter(classId = 9, level = 200): Character { return { classId, level, baseStats: {}, scrollStats: {}, allocationMode: 'automatic' }; }
export function defaultTarget(): CombatTarget { return { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' }; }
export function getSpellLevel(spell: Spell, level = 200): SpellLevel | undefined {
  return spell.levels.filter(entry => entry.minPlayerLevel <= level).sort((a, b) => b.minPlayerLevel - a.minPlayerLevel || b.grade - a.grade)[0];
}
const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;
export function canIncludePower(constraint: Pick<Constraint, 'kind' | 'statKey'>): boolean {
  return constraint.kind === 'stat' && ['strength', 'intelligence', 'chance', 'agility'].includes(constraint.statKey || '');
}
/** Value of this objective only. Power never alters item prerequisites or derived utility stats. */
export function getStatConstraintValue(constraint: Constraint, stats: Stats): number {
  return finite(stats[constraint.statKey || '']) + (constraint.includePower && canIncludePower(constraint) ? finite(stats.damagePercent) : 0);
}
/** Static critical chance, independent of whether the spell deals direct damage.
 * A spell without a critical base cannot gain critical casts from equipment.
 */
export function calculateSpellCriticalChance(spell: Spell, stats: Stats, characterLevel = 200): number | null {
  const level = getSpellLevel(spell, characterLevel);
  if (!level) return null;
  if (level.criticalHitProbability <= 0) return 0;
  return Math.max(0, Math.min(100, level.criticalHitProbability + finite(stats.criticalHit)));
}
const sumRange = (entries: DamageRange[]): DamageRange => entries.reduce((sum, entry) => ({ min: sum.min + entry.min, average: sum.average + entry.average, max: sum.max + entry.max }), { min: 0, average: 0, max: 0 });
const damageElements: Record<number, Element> = { 91: 'water', 92: 'earth', 93: 'air', 94: 'fire', 95: 'neutral', 96: 'water', 97: 'earth', 98: 'air', 99: 'fire', 100: 'neutral' };
const elementStat: Record<Element, string> = { neutral: 'strength', earth: 'strength', fire: 'intelligence', water: 'chance', air: 'agility' };
const nonDamageEffects = new Set([5, 6, 9, 10, 11, 50, 51, 77, 78, 81, 108, 110, 111, 115, 117, 118, 119, 123, 124, 125, 126, 128, 131, 132, 138, 140, 144, 145, 149, 150, 154, 155, 156, 157, 160, 161, 162, 163, 164, 165, 166, 168, 169, 171, 176, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 240, 241, 242, 243, 244, 265, 266, 269, 270, 271, 272, 293, 320, 401, 402, 403, 405, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443, 444, 445, 446, 447, 448, 449, 750, 751, 765, 766, 776, 950, 951]);
// These effects can change the damage of the cast itself. Until target masks,
// ordering and states are modelled, a preview containing one is only partial.
for (const id of [144, 265, 266, 269, 271, 118, 119, 123, 126, 138, 215, 216, 217, 218, 219, 418, 419]) nonDamageEffects.delete(id);
// AP removal and received-healing reduction do not alter the displayed damage.
nonDamageEffects.add(1079);
nonDamageEffects.add(1159);

/** Pure function: the same per-line arithmetic is used by React and the worker.
 * Scope: immediate elemental damage/life steal, fixed target, no external buffs.
 * The recast table is ONE later cast after an initial cast, not a whole rotation.
 */
export function calculateSpellDamage(spell: Spell, stats: Stats, target: CombatTarget = defaultTarget(), characterLevel = 200, context: SpellCalculationContext = {}): SpellDamage {
  const level = getSpellLevel(spell, characterLevel);
  if (level?.effects.some(effect => effect.order !== undefined)) return calculateNativeSpellDamage(spell, stats, target, characterLevel, context);
  return calculateLegacySpellDamage(spell, stats, target, characterLevel);
}
function calculateLegacySpellDamage(spell: Spell, stats: Stats, target: CombatTarget = defaultTarget(), characterLevel = 200): SpellDamage {
  const level = getSpellLevel(spell, characterLevel);
  const empty: SpellDamage = { spellId: spell.id, levelId: level?.id ?? 0, apCost: level?.apCost ?? 0, critChance: 0, normal: sumRange([]), critical: null, expected: 0, perAp: 0, lines: [], turns: [], supported: false, warnings: [] };
  if (!level) return { ...empty, warnings: ['Sort non disponible à ce niveau.'] };
  const warnings = new Set<string>(spell.dataWarnings ?? []);
  let unsupported = warnings.size > 0;
  const normals = level.effects.filter(effect => damageElements[effect.effectId] && effect.targetMask !== 'C');
  const criticals = level.criticalEffects.filter(effect => damageElements[effect.effectId] && effect.targetMask !== 'C');
  const chargeEffects = level.effects.filter(effect => effect.effectId === 293 && effect.diceNum === spell.id);
  for (const effect of [...level.effects, ...level.criticalEffects]) {
    if (damageElements[effect.effectId]) {
      if ((effect.delay ?? 0) > 0 || (effect.duration ?? 0) > 0 || (effect.triggers && effect.triggers !== 'I') || (effect.random ?? 0) > 0 || /\d/.test(effect.targetMask ?? '')) {
        unsupported = true;
        warnings.add('Dégâts conditionnels, aléatoires ou périodiques : aperçu partiel, non utilisable comme seuil garanti.');
      }
    } else if (!nonDamageEffects.has(effect.effectId)) {
      // Punitive's invisible 3793 effects reset its scheduled script. Its visible
      // 293 bonuses suffice only for the explicitly isolated-recast scenario.
      if (effect.effectId === 3793 && chargeEffects.length && (effect.delay ?? 0) > 0) {
        warnings.add('Relances projetées après un lancement initial, sans lancer intermédiaire ni buff externe.');
      } else {
        unsupported = true;
        warnings.add('Ce sort comporte des mécaniques non simulées (états, invocations, sous-sorts ou effets spéciaux).');
      }
    }
  }
  if (!normals.length && !criticals.length) {
    warnings.add('Aucune ligne de dégâts directs calculable. Consulter les effets du sort.');
    unsupported = true;
  }
  const rollDamage = (base: number, element: Element, critical: boolean): number => {
    const stat = Math.max(0, finite(stats[elementStat[element]]) + finite(stats.damagePercent));
    const flat = finite(stats.allDamageBonus) + finite(stats[element + 'DamageBonus']) + (critical ? finite(stats.criticalDamageBonus) : 0);
    const beforeResist = Math.floor(base * (100 + stat) / 100) + flat;
    const fixedResist = finite(target.flat[element]) + (critical ? finite(target.criticalResistance) : 0);
    const percentFactor = Math.max(0, 1 - finite(target.percent[element]) / 100);
    const afterResist = Math.floor(Math.max(0, beforeResist - fixedResist) * percentFactor);
    const spellMultiplier = Math.max(0, 1 + finite(stats.dealtDamageMultiplierSpells) / 100);
    const distanceMultiplier = Math.max(0, 1 + finite(stats[target.distance === 'melee' ? 'dealtDamageMultiplierMelee' : 'dealtDamageMultiplierDistance']) / 100);
    const finalMultiplier = Math.max(0, 1 + finite(stats.dealtDamageMultiplier) / 100);
    return Math.max(0, Math.floor(afterResist * spellMultiplier * distanceMultiplier * finalMultiplier));
  };
  const effectRange = (effect: RawEffect, critical: boolean, bonus = 0): DamageRange => {
    const min = Math.max(0, Math.floor(effect.diceNum || effect.value || 0) + bonus);
    const max = Math.max(min, Math.floor(effect.diceSide || effect.diceNum || effect.value || 0) + bonus);
    const element = damageElements[effect.effectId];
    if (max - min > 10000) { unsupported = true; warnings.add('Plage de dégâts non prise en charge.'); return sumRange([]); }
    let total = 0;
    for (let roll = min; roll <= max; roll++) total += rollDamage(roll, element, critical);
    return { min: rollDamage(min, element, critical), average: total / (max - min + 1), max: rollDamage(max, element, critical) };
  };
  const totals = (effects: RawEffect[], critical: boolean, bonus = 0) => sumRange(effects.map(effect => effectRange(effect, critical, bonus)));
  const normal = totals(normals, false);
  const critical = level.criticalHitProbability > 0 && criticals.length ? totals(criticals, true) : null;
  const critChance = calculateSpellCriticalChance(spell, stats, characterLevel) ?? 0;
  const expected = normal.average * (1 - critChance / 100) + (critical?.average ?? normal.average) * critChance / 100;
  const horizon = Math.min(12, Math.max(3, level.minCastInterval + 1, ...chargeEffects.map(effect => (effect.delay ?? 0) + Math.max(1, effect.duration ?? 1))));
  const turns = Array.from({ length: horizon + 1 }, (_, turn) => {
    const bonus = turn === 0 ? 0 : chargeEffects.filter(effect => turn >= (effect.delay ?? 0) && turn < (effect.delay ?? 0) + Math.max(1, effect.duration ?? 1)).reduce((sum, effect) => sum + effect.value, 0);
    return { turn, bonus, normal: totals(normals, false, bonus), critical: critical ? totals(criticals, true, bonus) : null, available: turn === 0 || turn >= Math.max(1, level.minCastInterval) };
  });
  if (chargeEffects.length) warnings.add('Relances projetées après un lancement initial, sans lancer intermédiaire ni buff externe.');
  return { spellId: spell.id, levelId: level.id, apCost: level.apCost, critChance, normal, critical, expected, perAp: level.apCost ? expected / level.apCost : 0, lines: normals.map((effect, index) => ({ element: damageElements[effect.effectId], baseMin: effect.diceNum || effect.value, baseMax: effect.diceSide || effect.diceNum || effect.value, normal: effectRange(effect, false), critical: criticals[index] ? effectRange(criticals[index], true) : null, delay: effect.delay ?? 0 })), turns, supported: !unsupported, warnings: [...warnings] };
}

const indexes = new WeakMap<Catalog, { items: Map<number, EquipmentItem>; spells: Map<number, Spell>; sets: Map<number, Catalog['sets'][number]> }>();
function index(catalog: Catalog) {
  let result = indexes.get(catalog);
  if (!result) { result = { items: new Map(catalog.items.map(item => [item.id, item])), spells: new Map(catalog.spells.map(spell => [spell.id, spell])), sets: new Map(catalog.sets.map(set => [set.id, set])) }; indexes.set(catalog, result); }
  return result;
}
function addStats(target: Stats, source: Stats) { for (const [key, value] of Object.entries(source)) if (Number.isFinite(value)) target[key] = finite(target[key]) + value; }
function compare(value: number, operator: ItemCondition['operator'], bound: number): boolean {
  if (operator === '>') return value > bound;
  if (operator === '<') return value < bound;
  if (operator === '>=') return value >= bound;
  if (operator === '<=') return value <= bound;
  if (operator === '=') return value === bound;
  if (operator === '!=') return value !== bound;
  return false;
}
function checkCondition(condition: ItemCondition, stats: Stats): boolean {
  if (condition.kind === 'and') return !!condition.children?.every(child => checkCondition(child, stats));
  if (condition.kind === 'or') return !!condition.children?.some(child => checkCondition(child, stats));
  if (condition.kind === 'stat' && condition.stat) return compare(finite(stats[condition.stat]), condition.operator, condition.value ?? 0);
  return false;
}
function scoreCriterion(constraint: Constraint, value: number | null): { satisfied: boolean; score: number } {
  if (value === null || !Number.isFinite(value)) return { satisfied: false, score: 0 };
  const scale = Math.max(1, Math.abs(constraint.target));
  if (constraint.relation === 'atLeast') return { satisfied: value >= constraint.target, score: Math.max(0, Math.min(1, 1 + (value - constraint.target) / scale)) };
  if (constraint.relation === 'atMost') return { satisfied: value <= constraint.target, score: Math.max(0, Math.min(1, 1 - (value - constraint.target) / scale)) };
  if (constraint.relation === 'minimize') return { satisfied: true, score: scale / (scale + Math.max(0, value)) };
  return { satisfied: true, score: Math.max(0, value) / (scale + Math.max(0, value)) };
}
export function evaluateBuild(catalog: Catalog, request: OptimizationRequest, build: Build): BuildEvaluation {
  const lookups = index(catalog);
  const character: Character = request.character.allocationMode === 'automatic' && build.baseStats
    ? { ...request.character, baseStats: build.baseStats } : request.character;
  const baseStats: Stats = { actionPoints: request.character.level >= 100 ? 7 : 6, movementPoints: 3, maxSummonedCreaturesBoost: 1, magicFind: 100, weight: 1000, hitPoints: 50 + request.character.level * 5 };
  addStats(baseStats, character.baseStats);
  const scrollStats: Stats = { ...request.character.scrollStats };
  const equipmentStats: Stats = {};
  const stats: Stats = { ...baseStats };
  addStats(stats, scrollStats);
  stats.level = request.character.level;
  stats.classId = request.character.classId;
  const characterPoints = getCharacterAllocation(character);
  const violations: string[] = [...characterPoints.violations];
  const warnings = new Set<string>();
  const items: EquipmentItem[] = [];
  const exoBonuses = [...new Set(build.exoBonuses ?? [])];
  if (exoBonuses.length !== (build.exoBonuses?.length ?? 0)) violations.push('Un bonus exotique PA ou PM ne peut être compté qu’une seule fois.');
  const maxExos = request.filters.maxExos ?? 2;
  if (!Number.isInteger(maxExos) || maxExos < 0 || maxExos > 2) violations.push('Le maximum d’exos doit être de 0, 1 ou 2.');
  else if (exoBonuses.length > maxExos) violations.push(`Ce stuff utilise ${exoBonuses.length} exo${exoBonuses.length > 1 ? 's' : ''}, pour un maximum autorisé de ${maxExos}.`);
  for (const exo of exoBonuses) {
    if (exo !== 'actionPoints' && exo !== 'movementPoints') { violations.push('Bonus exotique inconnu.'); continue; }
    if (!request.filters.allowedExos?.includes(exo)) violations.push(`Le bonus exotique ${exo === 'actionPoints' ? 'PA' : 'PM'} n’est pas autorisé dans cette recherche.`);
    equipmentStats[exo] = 1;
  }
  const used = new Set<number>();
  for (const [slot, id] of Object.entries(build.slots)) {
    if (!id) continue;
    const item = lookups.items.get(id);
    if (!SLOTS.includes(slot as Slot) || !item) { violations.push('Objet ou emplacement inconnu.'); continue; }
    if (used.has(id) && !(item.slotType === 'ring' && !item.setId)) violations.push(`${item.name} est équipé plusieurs fois.`);
    used.add(id);
    if (item.slotType !== slotType(slot as Slot)) violations.push(`${item.name} ne correspond pas à cet emplacement.`);
    if (item.level > request.character.level) violations.push(`${item.name} demande le niveau ${item.level}.`);
    if (request.filters.excludedItemIds.includes(id) || request.filters.excludedTypeIds.includes(item.typeId) || request.filters.excludedCategories.includes(item.category)) violations.push(`${item.name} fait partie des exclusions.`);
    if (request.filters.allowedItemIds && !request.filters.allowedItemIds.includes(id)) violations.push(`${item.name} ne fait pas partie des objets autorisés.`);
    items.push(item); addStats(equipmentStats, item.stats);
    for (const effect of item.unsupportedEffects ?? []) warnings.add(`${item.name} : ${effect}`);
    for (const warning of item.dataWarnings ?? []) {
      warnings.add(`${item.name} : ${warning}`);
      violations.push(`Données d'équipement à vérifier : ${item.name}.`);
    }
  }
  for (const [slot, id] of Object.entries(request.filters.lockedSlots)) if (id && build.slots[slot as Slot] !== id) violations.push('Un objet verrouillé est absent.');
  if (items.filter(item => item.typeId === 217).length > 1) violations.push('Une seule prysmaradite peut être équipée.');
  const setCounts = new Map<number, number>();
  items.forEach(item => { if (item.setId) setCounts.set(item.setId, (setCounts.get(item.setId) ?? 0) + 1); });
  const sets: BuildEvaluation['sets'] = [];
  let maxSetPieces = 0;
  let setBonusCount = 0;
  for (const [id, count] of setCounts) {
    maxSetPieces = Math.max(maxSetPieces, count);
    const set = lookups.sets.get(id);
    const bonus = set?.bonuses.filter(entry => entry.count <= count).sort((a, b) => b.count - a.count)[0];
    if (set && bonus) { addStats(equipmentStats, bonus.stats); sets.push({ id, name: set.name, count, stats: bonus.stats }); }
    if (count > 1) setBonusCount += count - 1;
  }
  stats.setBonusCount = setBonusCount;
  stats.maxSetPieces = maxSetPieces;
  stats.setBonus = setBonusCount;
  stats.activeSetCount = [...setCounts.values()].filter(count => count >= 2).length;
  addStats(stats, equipmentStats);
  const beforeDerived = { ...stats };
  stats.hitPoints = finite(stats.hitPoints) + finite(stats.vitality);
  stats.initiative = finite(stats.initiative) + finite(stats.strength) + finite(stats.intelligence) + finite(stats.chance) + finite(stats.agility);
  stats.magicFind += Math.floor(Math.max(0, finite(stats.chance)) / 10);
  stats.weight += Math.max(0, finite(stats.strength)) * 5;
  stats.tackleBlock = finite(stats.tackleBlock) + Math.floor(Math.max(0, finite(stats.agility)) / 10);
  stats.tackleEvade = finite(stats.tackleEvade) + Math.floor(Math.max(0, finite(stats.agility)) / 10);
  for (const key of ['DodgeApLostProbability', 'DodgeMpLostProbability', 'apReduction', 'mpReduction']) stats[key] = finite(stats[key]) + Math.floor(Math.max(0, finite(stats.wisdom)) / 10);
  for (const item of items) if (item.conditions && !checkCondition(item.conditions, stats)) violations.push(`Conditions non remplies ou à vérifier : ${item.name} — ${formatItemCondition(item.conditions, catalog)}.`);
  // Equipment prerequisites use the raw totals. Surplus characteristics are legal
  // to equip but does not improve the effective out-of-combat characteristics.
  for (const [key, cap] of Object.entries(STAT_CAPS)) {
    if (finite(stats[key]) > cap) {
      const label = catalog.stats.find(stat => stat.key === key)?.name ?? key;
      warnings.add(`${label} : ${stats[key]} équipés, ${cap} utilisables hors combat.`);
      stats[key] = cap;
    }
  }
  const { cost, knownCost, missingPrices, missingExoPrices } = calculateEquipmentPrice(items, exoBonuses, request.prices);
  const spellCache = new Map<number, SpellDamage>();
  let weaponDamage: WeaponDamage | undefined;
  const constraints = request.constraints.map(constraint => {
    let value: number | null = null;
    let supported = true;
    if (constraint.kind === 'stat') {
      value = getStatConstraintValue(constraint, stats);
      if (constraint.includePower && !canIncludePower(constraint)) supported = false;
    }
    if (constraint.kind === 'price') { value = cost; supported = cost !== null; }
    if (constraint.kind === 'spell') {
      const spell = lookups.spells.get(constraint.spellId ?? 0);
      if (!spell) supported = false;
      else if (constraint.metric === 'criticalChance') {
        value = calculateSpellCriticalChance(spell, stats, request.character.level);
        supported = value !== null && !spell.dataWarnings?.length
          && (!spell.classIds.length || spell.classIds.includes(request.character.classId));
        if (constraint.strict && items.some(item => item.unsupportedEffects?.length)) supported = false;
      } else {
        let damage = constraint.scenario ? undefined : spellCache.get(spell.id);
        if (!damage) { damage = calculateSpellDamage(spell, stats, request.target, request.character.level, { catalog, scenario: constraint.scenario }); if (!constraint.scenario) spellCache.set(spell.id, damage); }
        supported = damage.supported && (!spell.classIds.length || spell.classIds.includes(request.character.classId));
        const turnOffset = constraint.turnOffset ?? 0;
        const turn = damage.turns.find(entry => entry.turn === turnOffset);
        if (!turn?.available) supported = false;
        const range = constraint.mode === 'critical' ? turn?.critical : turn?.normal;
        value = range?.[constraint.metric ?? 'average'] ?? null;
        if (value === null) supported = false;
        if (constraint.strict && items.some(item => item.unsupportedEffects?.length)) supported = false;
      }
    }
    if (constraint.kind === 'weapon') {
      const weapon = lookups.items.get(build.slots.weapon ?? 0);
      if (!weapon || weapon.slotType !== 'weapon') supported = false;
      else if (constraint.metric === 'criticalChance') {
        value = calculateWeaponCriticalChance(weapon, stats, request.character.level);
        supported = value !== null && !weapon.dataWarnings?.length;
      } else {
        weaponDamage ??= calculateWeaponDamage(weapon, stats, request.target, request.character.level);
        supported = weaponDamage.supported;
        const range = constraint.mode === 'critical' ? weaponDamage.critical : weaponDamage.normal;
        value = range?.[constraint.metric ?? 'average'] ?? null;
        if (value === null) supported = false;
      }
      if ((constraint.turnOffset ?? 0) !== 0) supported = false;
      if (constraint.strict && items.some(item => item.unsupportedEffects?.length)) supported = false;
    }
    const result = scoreCriterion(constraint, supported ? value : null);
    if (constraint.strict && (!supported || !result.satisfied)) violations.push(`Exigence non satisfaite : ${constraint.id}.`);
    return { id: constraint.id, value, supported, satisfied: supported && result.satisfied, score: result.score };
  });
  const ranks = [...new Set(request.constraints.map(constraint => constraint.priority))].sort((a, b) => a - b);
  let numerator = 0, denominator = 0;
  request.constraints.forEach((constraint, position) => {
    const weight = ranks.length - ranks.indexOf(constraint.priority);
    numerator += weight * constraints[position].score;
    denominator += weight;
  });
  const maluses = calculateEquipmentMaluses(catalog, [...items.map(item => item.stats), ...sets.map(set => set.stats)]);
  const score = (denominator ? 100 * numerator / denominator : 0) - maluses.penalty;
  const breakdown: BuildEvaluation['breakdown'] = {};
  for (const key of new Set([...Object.keys(stats), ...Object.keys(baseStats), ...Object.keys(scrollStats), ...Object.keys(equipmentStats)])) {
    breakdown[key] = {
      base: finite(baseStats[key]), scroll: finite(scrollStats[key]), equipment: finite(equipmentStats[key]),
      derived: finite(stats[key]) - finite(beforeDerived[key]),
      power: ['strength', 'intelligence', 'chance', 'agility'].includes(key) ? finite(stats.damagePercent) : 0,
      total: finite(stats[key]),
    };
  }
  breakdown.hitPoints = {
    base: finite(baseStats.hitPoints) + finite(character.baseStats.vitality),
    scroll: finite(scrollStats.hitPoints) + finite(scrollStats.vitality),
    equipment: finite(equipmentStats.hitPoints) + finite(equipmentStats.vitality),
    derived: 0, power: 0, total: stats.hitPoints,
  };
  return { build: { slots: { ...build.slots }, exoBonuses, ...(request.character.allocationMode === 'automatic' ? { baseStats: { ...character.baseStats } } : {}) }, stats, cost, knownCost, missingPrices, missingExoPrices, sets, constraints, score, maluses, valid: violations.length === 0, violations, warnings: [...warnings], breakdown, characterPoints };
}
