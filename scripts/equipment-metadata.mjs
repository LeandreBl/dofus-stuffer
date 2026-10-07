/** Native WeaponData fields; public DofusDB exposes the same names.
 * Zero is a meaningful source value, never replaced with a guessed default.
 */
export const WEAPON_FIELDS = ['apCost', 'minRange', 'range', 'criticalHitProbability', 'criticalHitBonus', 'maxCastPerTurn'];
export function normalizeWeaponMetadata(item, slotType) {
  if (slotType !== 'weapon') return undefined;
  const fields = Object.fromEntries(WEAPON_FIELDS.map(key => [key, item[key]]));
  if (Object.values(fields).some(value => !Number.isInteger(value))) return undefined;
  if (fields.apCost < 0 || fields.apCost > 100 || fields.minRange < 0 || fields.range < fields.minRange || fields.range > 100
    || fields.criticalHitProbability < 0 || fields.criticalHitProbability > 100
    || Math.abs(fields.criticalHitBonus) > 1_000 || fields.maxCastPerTurn < 0 || fields.maxCastPerTurn > 100) return undefined;
  return fields;
}

/** EffectData.useInFight distinguishes the attack's effects from passive equipment bonuses.
 * E.g. 101/127 remove AP/MP from the target; 168/169 are the owner's passive penalties.
 */
export function effectFightUsage(definition) {
  const value = definition?.useInFight;
  return value === true || value === 1 ? true : value === false || value === 0 ? false : undefined;
}
export function effectsForEquipmentStats(effects, slotType, definitions) {
  return slotType === 'weapon' ? (effects || []).filter(effect => effectFightUsage(definitions.get(effect.effectId)) !== true) : (effects || []);
}
