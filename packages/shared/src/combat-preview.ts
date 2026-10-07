import { calculateSpellDamage, getSpellLevel } from './index.js';
import { calculateWeaponDamage } from './weapon-damage.js';
import type { Build, Catalog, Character, CombatTarget, EquipmentItem, ItemPassive, RawEffect, Spell, SpellScenario, Stats } from './types.js';

export interface PassiveActivation { enabled: boolean; value?: number; remainingTurns?: number; }
export interface BoostActivation { enabled: boolean; critical?: boolean; stacks?: number; age?: number; }
export interface CombatPreviewState {
  turn: number;
  passives: Record<string, PassiveActivation>;
  boosts: Record<string, BoostActivation>;
}
export interface PreviewPassive {
  key: string;
  item: EquipmentItem;
  passive: ItemPassive;
  label: string;
  stats: Stats;
  duration?: number;
  parameter?: { label: string; min: number; max: number; step: number; defaultValue: number; shortcuts: number[] };
  dynamic?: 'nebula' | 'dofusteuse' | 'prynyang';
  status: 'supported' | 'partial' | 'utility' | 'unsupported';
  note?: string;
}
export interface PreviewBoost { spell: Spell; effects: RawEffect[]; criticalEffects: RawEffect[]; duration: number; maxStacks: number; }
export interface CombatPreviewContext { bonuses: Stats; statsAtOffset: Stats[]; catalog?: Catalog; }

export const defaultCombatPreview = (): CombatPreviewState => ({ turn: 1, passives: {}, boosts: {} });
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const integer = (value: number | undefined, min: number, max: number, fallback: number) => Math.min(max, Math.max(min, Math.floor(finite(value, fallback))));
const bonusEffects: Readonly<Record<number, [string, number]>> = {
  112: ['allDamageBonus', 1], 121: ['allDamageBonus', 1], 115: ['criticalHit', 1],
  118: ['strength', 1], 119: ['agility', 1], 123: ['chance', 1], 126: ['intelligence', 1],
  138: ['damagePercent', 1], 145: ['allDamageBonus', -1], 152: ['chance', -1],
  153: ['vitality', -1], 154: ['agility', -1], 155: ['intelligence', -1], 157: ['strength', -1],
  414: ['pushDamageBonus', 1], 418: ['criticalDamageBonus', 1], 419: ['criticalDamageBonus', -1],
  422: ['earthDamageBonus', 1], 424: ['fireDamageBonus', 1], 426: ['waterDamageBonus', 1],
  428: ['airDamageBonus', 1], 430: ['neutralDamageBonus', 1], 1144: ['weaponPower', 1],
  1171: ['dealtDamageMultiplier', 1], 1172: ['dealtDamageMultiplier', -1],
  2800: ['dealtDamageMultiplierMelee', 1], 2801: ['dealtDamageMultiplierMelee', -1],
  2804: ['dealtDamageMultiplierDistance', 1], 2805: ['dealtDamageMultiplierDistance', -1],
  2808: ['dealtDamageMultiplierWeapon', 1], 2809: ['dealtDamageMultiplierWeapon', -1],
  2812: ['dealtDamageMultiplierSpells', 1], 2813: ['dealtDamageMultiplierSpells', -1],
};
const effectValue = (effect: RawEffect) => finite(effect.diceNum) || finite(effect.value);
function add(target: Stats, source: Stats, count = 1) {
  for (const [key, value] of Object.entries(source)) target[key] = finite(target[key]) + finite(value) * count;
}
function effectStats(effects: RawEffect[]): Stats {
  const stats: Stats = {};
  for (const effect of effects) {
    const mapping = bonusEffects[effect.effectId];
    if (mapping) add(stats, { [mapping[0]]: effectValue(effect) * mapping[1] });
  }
  return stats;
}

/** The checkbox asserts that the described trigger has ALREADY happened.
 * Native effects supply magnitudes. Branch/stack semantics are explicit; raw
 * branches are never all added together. No trigger is inferred from a build.
 */
export function getPreviewPassives(catalog: Catalog, build: Build): PreviewPassive[] {
  const equipped = new Set(Object.values(build.slots));
  return catalog.items.filter(item => equipped.has(item.id)).flatMap(item => (item.passives ?? []).flatMap(passive => {
    const base = { item, passive, key: `item:${item.id}:${passive.id}`, label: passive.name || 'Passif', stats: {} as Stats, status: 'supported' as PreviewPassive['status'] };
    const find = (id: number) => passive.effects.find(effect => effect.effectId === id);
    const single = (id: number, label = base.label): PreviewPassive => {
      const effect = find(id);
      return { ...base, label, stats: effect ? effectStats([effect]) : {}, duration: effect && effect.duration && effect.duration > 0 ? effect.duration : undefined,
        status: effect ? 'supported' : 'unsupported', note: effect ? undefined : 'Données de ce bonus indisponibles.' };
    };
    const stacks = (id: number, max: number, label = base.label): PreviewPassive => ({ ...single(id, label),
      parameter: { label: 'Cumuls actifs', min: 1, max, step: 1, defaultValue: 1, shortcuts: [...new Set([1, Math.ceil(max / 2), max])] } });
    if ([8395, 5952, 31607].includes(passive.id)) {
      const result = stacks(1171, 10);
      if (passive.id === 31607) { result.status = 'partial'; result.note = 'Le bonus de dommages est inclus. L’explosion autour de l’invocation est un dégât séparé, non inclus dans cette attaque.'; }
      return [result];
    }
    if (passive.id === 8396 || passive.id === 18672) return [single(1171)];
    if (passive.id === 5454) return [{ ...base, dynamic: 'nebula', note: 'Le tour de combat choisit automatiquement +20 % en tour impair ou −10 % en tour pair.' }];
    if (passive.id === 18888) return [single(112, 'Bonus de dommages déclenché')];
    if (passive.id === 17006) return [{ ...base, stats: { allDamageBonus: 1 }, parameter: {
      label: 'Dommages déjà accumulés', min: 0, max: 64, step: 8, defaultValue: 16, shortcuts: [16, 32, 64] },
      note: 'Total gagné à la fin des quatre premiers tours : 16, 8 ou 0 par tour selon les attaques. Il reste actif jusqu’à la fin du combat.' }];
    if (passive.id === 18629) return [stacks(2804, 5, 'Bonus aux dégâts à distance'), stacks(2800, 5, 'Bonus aux dégâts en mêlée')].map((entry, index) => ({
      ...entry, key: `${base.key}:${index}`, status: 'partial' as const,
      note: 'Le bonus est inclus. Le poison de l’Ébène se déclenche séparément et n’est pas ajouté aux dégâts de ce coup.' }));
    if (passive.id === 20981) return [
      { ...single(138, 'Puissance Brâkmarienne'), key: `${base.key}:power` },
      { ...single(1171, 'Œil du Cauchemar'), key: `${base.key}:eye`, note: 'Suppose les deux effets déjà déclenchés. Les 100 de Puissance sont également inclus, une seule fois.' },
    ];
    if (passive.id === 28516) return [{ ...single(138), parameter: {
      label: 'PM déjà utilisés sur les deux tours', min: 1, max: 200, step: 1, defaultValue: 6, shortcuts: [3, 6, 12] } }];
    if (passive.id === 7331) return [{ ...base, dynamic: 'dofusteuse', note: 'Cycle par tour : Chance, Force, Agilité, Intelligence. Le tour de combat choisit la caractéristique active.' }];
    if (passive.id === 14913) return [{ ...base, dynamic: 'prynyang', note: 'Dommages des trois premiers tours : +10 %, +3 %, puis −10 %. Les résistances défensives ne modifient pas les dégâts de cette attaque.' }];
    if (passive.id === 11359) return [{ ...single(1171), note: 'Suppose que le porteur conserve plus de 50 % de ses PV à chaque lancer affiché. La perte de PV n’est pas simulée.' }];
    if (passive.id === 11360) return [stacks(1171, 5)];
    if (passive.id === 31856) return [{ ...stacks(1171, 4), parameter: { label: 'Combattants ennemis en vie', min: 1, max: 4, step: 1, defaultValue: 1, shortcuts: [1, 2, 4] } }];
    if (passive.id === 31860) return [{ ...single(1171, 'Bonus personnel après un ennemi achevé'), status: 'partial', note: 'Le bonus personnel est inclus. La vulnérabilité globale et l’érosion des combattants ne sont pas simulées.' }];
    if ([8393, 8418, 18665, 8394, 5453, 6149, 6828, 10164, 18674, 12344, 17307].includes(passive.id)) return [{ ...base,
      status: 'utility', note: 'Effet défensif, soin ou mobilité : ne modifie pas les dégâts de cette attaque.' }];
    // Simple native passives are safe only when every visible branch is a
    // deterministic bonus on the holder. Anything else needs a named rule.
    if (passive.effects.length && passive.effects.every(effect => bonusEffects[effect.effectId] && effect.targetMask === 'C'
      && !effect.random && !effect.delay && (!effect.diceSide || effect.diceSide === effect.diceNum))
      && new Set(passive.effects.map(effect => effect.effectId)).size === passive.effects.length) {
      const duration = Math.min(...passive.effects.map(effect => effect.duration && effect.duration > 0 ? effect.duration : Infinity));
      return [{ ...base, stats: effectStats(passive.effects), duration: Number.isFinite(duration) ? duration : undefined }];
    }
    return [{ ...base, status: 'unsupported', note: 'Ce déclenchement nécessite une simulation spécifique ; aucun bonus n’est inventé.' }];
  }));
}

/** Benefits from a spell already cast on this character, including an ally's
 * boost. State-dependent target masks and random values are not guessed.
 */
export function getPreviewBoosts(catalog: Catalog, character: Character): PreviewBoost[] {
  const eligible = (effect: RawEffect) => !!bonusEffects[effect.effectId] && effect.visibleInTooltip !== false
    && !effect.random && (!effect.diceSide || effect.diceSide === effect.diceNum)
    && (!effect.triggers || effect.triggers === 'I') && !/[\d*!]/.test(effect.targetMask ?? '')
    && (effect.targetMask ?? '').split(',').some(mask => ['C', 'A', 'a', 'g'].includes(mask));
  return catalog.spells.flatMap(spell => {
    const level = getSpellLevel(spell, character.level);
    if (!level) return [];
    const effects = level.effects.filter(eligible), criticalEffects = level.criticalEffects.filter(eligible);
    if (!effects.some(effect => bonusEffects[effect.effectId][1] > 0)) return [];
    return [{ spell, effects, criticalEffects, duration: Math.max(1, ...[...effects, ...criticalEffects].map(effect => Math.max(0, effect.duration ?? 0) + Math.max(0, effect.delay ?? 0))),
      maxStacks: Math.max(1, Math.min(20, level.maxStack || 1)) }];
  });
}

export function getPreviewBoostBonuses(boost: PreviewBoost, critical = false): Stats {
  return effectStats(critical && boost.criticalEffects.length ? boost.criticalEffects : boost.effects);
}
export function getPreviewPassiveBonuses(entry: PreviewPassive, turn: number, value?: number): Stats {
  const currentTurn = integer(turn, 1, 1012, 1);
  if (entry.dynamic) {
    const effect = entry.dynamic === 'nebula'
      ? entry.passive.effects.find(effect => effect.effectId === (currentTurn % 2 ? 1171 : 1172))
      : entry.dynamic === 'dofusteuse'
        ? entry.passive.effects.find(effect => effect.effectId === [123, 118, 119, 126][(currentTurn - 1) % 4])
        : entry.passive.effects.find(effect => [1171, 1172].includes(effect.effectId) && effect.delay === currentTurn - 1);
    return effect ? effectStats([effect]) : {};
  }
  const parameter = entry.parameter;
  const count = parameter ? parameter.min + Math.floor((integer(value, parameter.min, parameter.max, parameter.defaultValue) - parameter.min) / parameter.step) * parameter.step : 1;
  return Object.fromEntries(Object.entries(entry.stats).map(([key, bonus]) => [key, bonus * count]));
}
export function getCombatPreviewBonuses(catalog: Catalog, build: Build, character: Character, state: CombatPreviewState, offset = 0,
  definitions = { passives: getPreviewPassives(catalog, build), boosts: getPreviewBoosts(catalog, character) }): Stats {
  const stats: Stats = {};
  const passives = definitions.passives;
  for (const entry of passives) {
    const activation = state.passives[entry.key];
    if (!activation?.enabled || entry.status === 'unsupported') continue;
    if (entry.duration && offset >= integer(activation.remainingTurns, 1, entry.duration, entry.duration)) continue;
    add(stats, getPreviewPassiveBonuses(entry, integer(state.turn, 1, 999, 1) + offset, activation.value));
    const power = state.passives[`item:${entry.item.id}:20981:power`];
    const powerDuration = entry.passive.effects.find(effect => effect.effectId === 138)?.duration ?? 1;
    if (entry.key.endsWith(':20981:eye') && !(power?.enabled && offset < integer(power.remainingTurns, 1, powerDuration, powerDuration))) {
      const effect = entry.passive.effects.find(effect => effect.effectId === 138);
      if (effect) add(stats, effectStats([effect]));
    }
  }
  for (const boost of definitions.boosts) {
    const activation = state.boosts[String(boost.spell.id)];
    if (!activation?.enabled) continue;
    const age = integer(activation.age, 0, boost.duration, 0) + offset;
    const effects = activation.critical && boost.criticalEffects.length ? boost.criticalEffects : boost.effects;
    const active = effects.filter(effect => age >= Math.max(0, effect.delay ?? 0)
      && (effect.duration === -1 || age < Math.max(0, effect.delay ?? 0) + Math.max(1, effect.duration ?? 1)));
    add(stats, effectStats(active), integer(activation.stacks, 1, boost.maxStacks, 1));
  }
  return stats;
}
export function getCombatPreviewStats(catalog: Catalog, build: Build, character: Character, stats: Stats, state: CombatPreviewState, offset = 0): Stats {
  const result = { ...stats };
  add(result, getCombatPreviewBonuses(catalog, build, character, state, offset));
  return result;
}
export function createCombatPreviewContext(catalog: Catalog, build: Build, character: Character, stats: Stats, state: CombatPreviewState): CombatPreviewContext {
  const definitions = { passives: getPreviewPassives(catalog, build), boosts: getPreviewBoosts(catalog, character) };
  const bonuses = getCombatPreviewBonuses(catalog, build, character, state, 0, definitions);
  const statsAtOffset = Array.from({ length: 13 }, (_, offset) => {
    const result = { ...stats };
    add(result, offset ? getCombatPreviewBonuses(catalog, build, character, state, offset, definitions) : bonuses);
    return result;
  });
  return { bonuses, statsAtOffset, catalog };
}
export function calculatePreviewSpellDamage(spell: Spell, character: Character, target: CombatTarget, context: CombatPreviewContext, scenario?: SpellScenario) {
  const result = calculateSpellDamage(spell, context.statsAtOffset[0], target, character.level, { catalog: context.catalog, scenario });
  return { ...result, warnings: result.warnings.map(warning => warning.replace(' ni buff externe', '')), turns: result.turns.map(turn => {
    if (!turn.turn) return { ...turn, critChance: result.critChance };
    const later = calculateSpellDamage(spell, context.statsAtOffset[turn.turn] ?? context.statsAtOffset[12], target, character.level, { catalog: context.catalog, scenario });
    const range = later.turns.find(entry => entry.turn === turn.turn)!;
    return { ...turn, normal: range.normal, critical: range.critical, critChance: later.critChance };
  }) };
}
export function calculatePreviewWeaponDamage(item: EquipmentItem, character: Character, target: CombatTarget, context: CombatPreviewContext) {
  return calculateWeaponDamage(item, context.statsAtOffset[0], target, character.level);
}
