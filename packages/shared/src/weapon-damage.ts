import type { CombatTarget, DamageRange, Element, EquipmentItem, RawEffect, Stats, WeaponDamage } from './types.js';

const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;
const sumRange = (entries: DamageRange[]): DamageRange => entries.reduce((sum, entry) => ({ min: sum.min + entry.min, average: sum.average + entry.average, max: sum.max + entry.max }), { min: 0, average: 0, max: 0 });
const damageElements: Record<number, Element> = { 91: 'water', 92: 'earth', 93: 'air', 94: 'fire', 95: 'neutral', 96: 'water', 97: 'earth', 98: 'air', 99: 'fire', 100: 'neutral' };
const elementStat: Record<Element, string> = { neutral: 'strength', earth: 'strength', fire: 'intelligence', water: 'chance', air: 'agility' };
// Older snapshots did not carry useInFight. Only established equipment bonus
// families are ignored in that case; unknown effects cannot certify a threshold.
const equipmentBonusEffects = new Set([111, 112, 115, 116, 117, 118, 119, 123, 124, 125, 126, 128, 138, 152, 153, 154, 155, 156, 157, 160, 161, 162, 163, 168, 169, 171, 174, 175, 176, 178, 179, 182, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 225, 226, 240, 241, 242, 243, 244, 246, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 752, 753, 754, 755, 1144, 2802, 2803, 2805, 2807, 2808, 2809, 2990]);
const equipmentMetadataEffects = new Set([10, 146, 148, 149, 795, 812, 981, 983, 2818, 2871]);
const nonDamageCombatEffects = new Set([77, 101, 127, 130]);

function hasWeaponMetadata(item: EquipmentItem, characterLevel: number): boolean {
  const weapon = item.weapon;
  return item.slotType === 'weapon' && item.level <= characterLevel && !!weapon
    && Number.isFinite(weapon.apCost) && weapon.apCost > 0
    && Number.isFinite(weapon.minRange) && weapon.minRange >= 0
    && Number.isFinite(weapon.range) && weapon.range >= weapon.minRange
    && Number.isFinite(weapon.maxCastPerTurn) && weapon.maxCastPerTurn >= 0
    && Number.isFinite(weapon.criticalHitProbability) && weapon.criticalHitProbability >= 0 && weapon.criticalHitProbability <= 100
    && Number.isFinite(weapon.criticalHitBonus);
}

/** Chance for this weapon's own attack, independent from damage line support. */
export function calculateWeaponCriticalChance(item: EquipmentItem, stats: Stats, characterLevel = 200): number | null {
  if (!hasWeaponMetadata(item, characterLevel)) return null;
  const base = item.weapon!.criticalHitProbability;
  return base > 0 ? Math.max(0, Math.min(100, base + finite(stats.criticalHit))) : 0;
}

/** One attack on the selected target, using the weapon's natural damage element.
 * Equipment jets already contribute through stats; raw bonus effects are not
 * applied again. Weapon critical bonuses increase every direct damage/life-steal
 * base line before characteristics and flat critical damage are applied.
 */
export function calculateWeaponDamage(item: EquipmentItem, stats: Stats, target: CombatTarget = { percent: {}, flat: {}, criticalResistance: 0, distance: 'ranged' }, characterLevel = 200): WeaponDamage {
  const weapon = item.weapon;
  const empty: WeaponDamage = {
    itemId: item.id, apCost: weapon?.apCost ?? 0, minRange: weapon?.minRange ?? 0,
    range: weapon?.range ?? 0, maxCastPerTurn: weapon?.maxCastPerTurn ?? 0,
    critChance: 0, normal: sumRange([]), critical: null, expected: 0, perAp: 0, lines: [], supported: false, warnings: [],
  };
  if (!hasWeaponMetadata(item, characterLevel)) return {
    ...empty, warnings: [item.level > characterLevel ? `Arme non disponible avant le niveau ${item.level}.` : 'Caractéristiques d’attaque de cette arme absentes ou non valides.'],
  };
  const warnings = new Set<string>([...(item.dataWarnings ?? []), ...(item.unsupportedEffects ?? [])]);
  let unsupported = warnings.size > 0;
  const effects = item.effects ?? [];
  const attacks = effects.filter(effect => damageElements[effect.effectId] && effect.targetMask !== 'C');
  for (const effect of effects) {
    if (damageElements[effect.effectId]) {
      if ((effect.delay ?? 0) > 0 || (effect.duration ?? 0) > 0 || (effect.triggers && effect.triggers !== 'I') || (effect.random ?? 0) > 0 || /\d/.test(effect.targetMask ?? '') || effect.targetMask === 'C') {
        unsupported = true;
        warnings.add('Cette arme comporte des dégâts conditionnels, périodiques ou sur le lanceur : aperçu partiel, sans seuil garanti.');
      }
      continue;
    }
    if (equipmentMetadataEffects.has(effect.effectId)) continue;
    if (nonDamageCombatEffects.has(effect.effectId)) {
      warnings.add('Le retrait de PA/PM ou de kamas n’est pas inclus dans les dégâts affichés.');
      continue;
    }
    if (effect.isInFight === false || (effect.isInFight === undefined && equipmentBonusEffects.has(effect.effectId))) continue;
    unsupported = true;
    warnings.add(`Effet d’arme non simulé (${effect.effectId}) : aperçu partiel, sans seuil garanti.`);
  }
  if (!attacks.length) { unsupported = true; warnings.add('Aucune ligne de dégâts directs calculable pour cette arme.'); }
  if (finite(stats.weaponDamagePercent) !== 0) {
    unsupported = true;
    warnings.add('Le modificateur de maîtrise d’arme ancien n’est pas modélisé.');
  }
  const rollDamage = (base: number, element: Element, critical: boolean): number => {
    const characteristic = Math.max(0, finite(stats[elementStat[element]]) + finite(stats.damagePercent) + finite(stats.weaponPower));
    const flat = finite(stats.allDamageBonus) + finite(stats[element + 'DamageBonus']) + (critical ? finite(stats.criticalDamageBonus) : 0);
    const beforeResist = Math.floor(base * (100 + characteristic) / 100) + flat;
    const fixedResist = finite(target.flat[element]) + (critical ? finite(target.criticalResistance) : 0);
    const afterResist = Math.floor(Math.max(0, beforeResist - fixedResist) * Math.max(0, 1 - finite(target.percent[element]) / 100));
    const weaponMultiplier = Math.max(0, 1 + finite(stats.dealtDamageMultiplierWeapon) / 100);
    const distanceMultiplier = Math.max(0, 1 + finite(stats[target.distance === 'melee' ? 'dealtDamageMultiplierMelee' : 'dealtDamageMultiplierDistance']) / 100);
    const finalMultiplier = Math.max(0, 1 + finite(stats.dealtDamageMultiplier) / 100);
    return Math.max(0, Math.floor(afterResist * weaponMultiplier * distanceMultiplier * finalMultiplier));
  };
  const effectRange = (effect: RawEffect, critical: boolean): DamageRange => {
    const bonus = critical ? weapon!.criticalHitBonus : 0;
    const min = Math.max(0, Math.floor(finite(effect.diceNum) || finite(effect.value)) + bonus);
    const max = Math.max(min, Math.floor(finite(effect.diceSide) || finite(effect.diceNum) || finite(effect.value)) + bonus);
    if (max - min > 10000) { unsupported = true; warnings.add('Plage de dégâts d’arme non prise en charge.'); return sumRange([]); }
    let total = 0;
    for (let roll = min; roll <= max; roll++) total += rollDamage(roll, damageElements[effect.effectId], critical);
    return { min: rollDamage(min, damageElements[effect.effectId], critical), average: total / (max - min + 1), max: rollDamage(max, damageElements[effect.effectId], critical) };
  };
  const criticalAvailable = weapon!.criticalHitProbability > 0;
  const lines = attacks.map(effect => ({
    element: damageElements[effect.effectId], baseMin: effect.diceNum || effect.value,
    baseMax: effect.diceSide || effect.diceNum || effect.value,
    normal: effectRange(effect, false), critical: criticalAvailable ? effectRange(effect, true) : null, delay: effect.delay ?? 0,
  }));
  const normal = sumRange(lines.map(line => line.normal));
  const critical = criticalAvailable && lines.length ? sumRange(lines.map(line => line.critical!)) : null;
  const critChance = calculateWeaponCriticalChance(item, stats, characterLevel) ?? 0;
  const expected = normal.average * (1 - critChance / 100) + (critical?.average ?? normal.average) * critChance / 100;
  return { ...empty, normal, critical, critChance, expected, perAp: expected / weapon!.apCost, lines, supported: !unsupported, warnings: [...warnings] };
}
