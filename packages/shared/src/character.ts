import type { Character, CharacterAllocation, Stats } from './types.js';

export const CHARACTER_STATS = ['vitality', 'strength', 'intelligence', 'chance', 'agility', 'wisdom'] as const;

/** Cost of invested characteristic points. Scrolls never advance these tiers. */
export function characterPointCost(stat: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || !CHARACTER_STATS.includes(stat as typeof CHARACTER_STATS[number])) return 0;
  if (stat === 'vitality') return value;
  if (stat === 'wisdom') return value * 3;
  return Math.min(value, 100)
    + Math.min(Math.max(value - 100, 0), 100) * 2
    + Math.min(Math.max(value - 200, 0), 100) * 3
    + Math.max(value - 300, 0) * 4;
}

export function getCharacterAllocation(character: Character): CharacterAllocation {
  const violations: string[] = [];
  const validLevel = Number.isInteger(character.level) && character.level >= 1 && character.level <= 200;
  if (!validLevel) violations.push('Le niveau du personnage doit être compris entre 1 et 200.');
  const available = validLevel ? (character.level - 1) * 5 : 0;
  let spent = 0;
  for (const [key, value] of Object.entries(character.baseStats)) {
    if (!CHARACTER_STATS.includes(key as typeof CHARACTER_STATS[number])) violations.push('Caractéristique de base non augmentable.');
    else if (!Number.isSafeInteger(value) || value < 0) violations.push('Les caractéristiques investies doivent être des entiers positifs ou nuls.');
    else spent += characterPointCost(key, value);
  }
  for (const [key, value] of Object.entries(character.scrollStats ?? {})) {
    if (!CHARACTER_STATS.includes(key as typeof CHARACTER_STATS[number])) violations.push('Caractéristique de parchotage inconnue.');
    else if (!Number.isInteger(value) || value < 0 || value > 100) violations.push('Le parchotage doit être compris entre 0 et 100 par caractéristique.');
  }
  const remaining = available - spent;
  if (remaining < 0) violations.push(`Répartition impossible : ${spent} points dépensés pour ${available} disponibles au niveau ${character.level}.`);
  return { available, spent, remaining, valid: violations.length === 0, violations: [...new Set(violations)] };
}

/** A legal starting allocation for search, not a replacement for objective scoring.
 * Preferences are internal search directions; scrolls never consume this budget.
 */
export function allocateCharacterStats(character: Character, preferredStats: Stats = { vitality: 1 }, minimumStats: Stats = {}): Stats {
  if (!Number.isInteger(character.level) || character.level < 1 || character.level > 200) return {};
  let remaining = (character.level - 1) * 5;
  // Infeasible minima are not a solution: restart legally and let the exact
  // evaluator reject unmet prerequisites/strict objectives for that candidate.
  const minimumAllocation = getCharacterAllocation({ ...character, baseStats: minimumStats });
  const baseStats: Stats = minimumAllocation.valid ? { ...minimumStats } : {};
  if (minimumAllocation.valid) remaining -= minimumAllocation.spent;
  const preferences = CHARACTER_STATS.filter(key => Number.isFinite(preferredStats[key]) && preferredStats[key] > 0);
  if (!preferences.length) preferences.push('vitality');
  while (remaining > 0) {
    let best: typeof CHARACTER_STATS[number] | undefined;
    let bestGain = -Infinity;
    let bestCost = 0;
    for (const key of preferences) {
      const value = baseStats[key] ?? 0;
      const cost = characterPointCost(key, value + 1) - characterPointCost(key, value);
      if (cost > remaining) continue;
      const gain = (preferredStats[key] > 0 ? preferredStats[key] : 1) / ((100 + value) * cost);
      if (gain > bestGain) { best = key; bestGain = gain; bestCost = cost; }
    }
    if (!best) { baseStats.vitality = (baseStats.vitality ?? 0) + remaining; break; }
    baseStats[best] = (baseStats[best] ?? 0) + 1;
    remaining -= bestCost;
  }
  return baseStats;
}
