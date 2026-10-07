import type { Catalog, EquipmentMaluses, Stats } from './types.js';

// Reference losses keep flat stats, percentages and mobility comparable.
// This is a ranking preference, never an equipment rule or a hard constraint.
const referenceLosses: Readonly<Stats> = {
  hitPoints: 4000, vitality: 3500,
  strength: 1000, intelligence: 1000, chance: 1000, agility: 1000,
  wisdom: 300, damagePercent: 200, weaponPower: 200, criticalHit: 50,
  actionPoints: 12, movementPoints: 6, range: 6, maxSummonedCreaturesBoost: 3,
  initiative: 1000, weight: 1000,
};
// Technical fields and quantities whose sign does not mean bonus/malus.
const ignored = new Set([
  'level', 'classId', 'setBonusCount', 'setBonus', 'activeSetCount', 'maxSetPieces',
  'extraScale', 'extraScalePercent', 'criticalMiss', 'permanentDamagePercent',
  'curPermanentDamage', 'incomingPercentDamageMultiplicator', 'hitPointLoss',
  'energyLoose', 'restrictionOnPlayer', 'restrictionOnOthers', 'alignementValue',
  'alignementSide', 'alignementRank', 'confusion', 'unlucky', 'passTurn', 'stopXP', 'StopDrop',
]);
const references = new WeakMap<Catalog, Map<string, number>>();

/** Gross permanent losses: positive gear/base/scrolls never hide a negative item line.
 * Active set bonuses are provided once, without derived-stat double counting.
 */
export function calculateEquipmentMaluses(catalog: Catalog, sources: readonly Stats[]): EquipmentMaluses {
  let scales = references.get(catalog);
  if (!scales) {
    scales = new Map(catalog.stats.map(stat => [stat.key,
      referenceLosses[stat.key] ?? (Number.isFinite(stat.defaultTarget) && stat.defaultTarget! > 0
        ? stat.defaultTarget! : stat.unit === '%' || /Percent|Multiplier/.test(stat.key) ? 20 : 50)]));
    references.set(catalog, scales);
  }
  const stats: Stats = {};
  let severity = 0;
  for (const source of sources) for (const [key, value] of Object.entries(source)) {
    if (!Number.isFinite(value) || value >= 0 || ignored.has(key)) continue;
    const scale = referenceLosses[key] ?? scales.get(key) ?? (/Percent|Multiplier|criticalHit/.test(key) ? 20 : 50);
    stats[key] = (stats[key] || 0) + value;
    severity += -value / scale;
  }
  return { stats, penalty: 25 * severity };
}
