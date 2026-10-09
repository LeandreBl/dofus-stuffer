import {
  allocateCharacterStats, calculateSpellCriticalChance, calculateSpellDamage, calculateWeaponCriticalChance,
  calculateWeaponDamage, canIncludePower, CHARACTER_STATS, characterPointCost, defaultTarget, evaluateBuild, getCharacterAllocation,
  getSpellElements, getSpellLevel, getStatConstraintValue, scoreCriterion, SLOTS, slotType, STAT_CAPS,
  type Build, type BuildEvaluation, type Catalog, type Constraint, type EquipmentItem, type ExoStat, type ItemCondition,
  type OptimizationRequest, type Slot, type SpellDamage, type Stats,
} from './index.js';

/** A request that can never be searched as given (locked item filtered out, missing prices...). */
export class SearchConfigurationError extends Error {}

export interface SearchSnapshot { evaluated: number; feasible: number; results: BuildEvaluation[]; }

export function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4_294_967_296;
  };
}

function itemPrice(item: EquipmentItem, request: OptimizationRequest): number | undefined {
  if (request.prices.mode === 'remaining' && request.prices.ownedItemIds.includes(item.id)) return 0;
  return request.prices.values[String(item.id)] ?? request.prices.automaticValues?.[String(item.id)];
}

const derivedAllocation: Record<string, { stat: string; factor: number }> = {
  hitPoints: { stat: 'vitality', factor: 1 }, magicFind: { stat: 'chance', factor: 0.1 },
  weight: { stat: 'strength', factor: 5 }, tackleBlock: { stat: 'agility', factor: 0.1 },
  tackleEvade: { stat: 'agility', factor: 0.1 },
  DodgeApLostProbability: { stat: 'wisdom', factor: 0.1 }, DodgeMpLostProbability: { stat: 'wisdom', factor: 0.1 },
  apReduction: { stat: 'wisdom', factor: 0.1 }, mpReduction: { stat: 'wisdom', factor: 0.1 },
};
const damageAllocation: Record<number, string> = { 91: 'chance', 92: 'strength', 93: 'agility', 94: 'intelligence', 95: 'strength',
  96: 'chance', 97: 'strength', 98: 'agility', 99: 'intelligence', 100: 'strength' };

/** Static desirability, only used to bias which items the search proposes first. */
function itemHeuristic(item: EquipmentItem, request: OptimizationRequest, catalog: Catalog): number {
  let score = item.level / 2_000;
  for (const constraint of request.constraints) {
    const weight = 1 / (1 + constraint.priority);
    if (constraint.kind === 'stat' && constraint.statKey) {
      const direction = constraint.relation === 'atMost' || constraint.relation === 'minimize' ? -1 : 1;
      score += weight * direction * getStatConstraintValue(constraint, item.stats) / Math.max(1, constraint.target);
    } else if (constraint.kind === 'spell' || constraint.kind === 'weapon') {
      if (constraint.metric === 'criticalChance') {
        const direction = constraint.relation === 'atMost' || constraint.relation === 'minimize' ? -1 : 1;
        const baseChance = constraint.kind === 'weapon' ? item.weapon?.criticalHitProbability || 0 : 0;
        score += weight * direction * ((item.stats.criticalHit || 0) + baseChance) / Math.max(1, constraint.target);
      } else if (constraint.kind === 'spell') {
        const spell = catalog.spells.find(value => value.id === constraint.spellId);
        const damage = (stats: Stats) => {
          if (!spell) return 0;
          const turn = calculateSpellDamage(spell, stats, defaultTarget(), request.character.level, { catalog, scenario: constraint.scenario })
            .turns.find(entry => entry.turn === (constraint.turnOffset ?? 0));
          return (constraint.mode === 'critical' ? turn?.critical : turn?.normal)?.[constraint.metric === 'min' || constraint.metric === 'max' ? constraint.metric : 'average'] ?? 0;
        };
        const base = damage({});
        score += weight * (damage(item.stats) - base) / Math.max(1, base) / 2.5;
      } else {
        for (const [key, value] of Object.entries(item.stats)) {
          if (/strength|intelligence|chance|agility|power|damage|critical/i.test(key)) score += weight * value / 250;
        }
        if (item.weapon) {
          const baseDamage = (item.effects || []).filter(effect => damageAllocation[effect.effectId]).reduce((sum, effect) =>
            sum + ((effect.diceNum || effect.value) + (effect.diceSide || effect.diceNum || effect.value)) / 2
              + (constraint.mode === 'critical' ? item.weapon!.criticalHitBonus : 0), 0);
          score += weight * baseDamage / 50;
        }
      }
    } else if (constraint.kind === 'price') {
      const price = itemPrice(item, request);
      if (price !== undefined) score -= weight * price / Math.max(1, constraint.target || 1_000_000);
      else score -= weight;
    }
  }
  return score;
}

/** Characteristics the automatic allocation should feed, weighted by objective. */
function allocationPreferences(catalog: Catalog, request: OptimizationRequest, weapon?: EquipmentItem): Stats {
  const weights: Stats = {};
  const add = (stat: string, weight: number) => { weights[stat] = (weights[stat] || 0) + weight; };
  for (const criterion of request.constraints) {
    if (criterion.relation === 'atMost' || criterion.relation === 'minimize') continue;
    const weight = 1 / ((1 + criterion.priority) * Math.max(100, criterion.target));
    if (criterion.kind === 'stat' && criterion.statKey) {
      if (CHARACTER_STATS.includes(criterion.statKey as typeof CHARACTER_STATS[number])) add(criterion.statKey, weight);
      else if (derivedAllocation[criterion.statKey]) {
        const derived = derivedAllocation[criterion.statKey];
        add(derived.stat, weight * derived.factor);
      } else if (criterion.statKey === 'initiative') for (const stat of ['strength', 'intelligence', 'chance', 'agility']) add(stat, weight);
    } else if ((criterion.kind === 'spell' || criterion.kind === 'weapon') && criterion.metric !== 'criticalChance') {
      const spell = catalog.spells.find(value => value.id === criterion.spellId);
      if (criterion.kind === 'spell' && spell && catalog.combatSpells?.length) {
        const result = calculateSpellDamage(spell, { hitPoints: 1050 }, request.target, request.character.level, { catalog, scenario: criterion.scenario });
        if (result.parameters?.includes('casterHpPercent')) add('vitality', weight);
        else {
          const elements = result.lines.length
            ? [...new Set(result.lines.filter(line => line.kind !== 'push' && line.kind !== 'life').map(line => line.element))]
            : getSpellElements(spell, request.character.level, catalog);
          const stats = { earth: 'strength', neutral: 'strength', fire: 'intelligence', water: 'chance', air: 'agility' };
          for (const element of elements) add(stats[element], weight);
        }
        continue;
      }
      const level = spell && getSpellLevel(spell, request.character.level);
      const effects = criterion.kind === 'weapon' ? weapon?.effects : criterion.mode === 'critical' ? level?.criticalEffects : level?.effects;
      for (const effect of effects || []) {
        const stat = damageAllocation[effect.effectId];
        const criticalBonus = criterion.kind === 'weapon' && criterion.mode === 'critical' ? weapon?.weapon?.criticalHitBonus || 0 : 0;
        if (stat) add(stat, weight * Math.max(1, ((effect.diceNum || effect.value) + (effect.diceSide || effect.diceNum || effect.value)) / 2 + criticalBonus) / 100);
      }
    }
  }
  const greatest = Math.max(0, ...Object.values(weights));
  weights.vitality = Math.max(weights.vitality || 0, greatest ? greatest * 0.02 : 1);
  return weights;
}

const HARD_WEIGHT = 100;
const MAX_WINNERS = 5;
const PRYSMARADITE = 217;
const WEAPON_SLOT = SLOTS.indexOf('weapon' as Slot);
const EXO_BITS: Record<ExoStat, number> = { actionPoints: 1, movementPoints: 2 };

/**
 * Simulated-annealing search over a compiled, vectorised model of `evaluateBuild`.
 * The fast model only steers the walk: every returned build is re-checked by the exact evaluator.
 * Synchronous and chunked (`run(evals)`) so it runs the same in a Node worker or a browser Web Worker.
 */
export function createSearch(catalog: Catalog, request: OptimizationRequest, seed = Math.floor(Math.random() * 4_294_967_296)) {
  const random = randomGenerator(seed);
  const character = request.character;
  const automatic = character.allocationMode === 'automatic';
  const excludedIds = new Set(request.filters.excludedItemIds);
  const excludedTypes = new Set(request.filters.excludedTypeIds);
  const excludedCategories = new Set(request.filters.excludedCategories);
  const allow = request.filters.allowedItemIds ? new Set(request.filters.allowedItemIds) : null;
  const needsKnownPrices = request.constraints.some(c => c.kind === 'price' && c.strict);
  const exoConfigurations = [...new Set(request.filters.allowedExos || [])].reduce<ExoStat[][]>((combinations, bonus) =>
    [...combinations, ...combinations.map(values => [...values, bonus])], [[]])
    .filter(combination => combination.length <= (request.filters.maxExos ?? 2))
    .filter(combination => !needsKnownPrices || combination.every(bonus => (request.prices.exoCosts?.[bonus] ?? request.prices.automaticExoCosts?.[bonus]) !== undefined
      || (request.prices.mode === 'remaining' && request.prices.ownedExos?.includes(bonus))));
  // A locked item overrides type and category exclusions for its own slot only.
  const lockedIds = new Set(Object.values(request.filters.lockedSlots));
  const groupExcluded = (item: EquipmentItem) => excludedTypes.has(item.typeId) || excludedCategories.has(item.category);
  const allowed = catalog.items.filter(item => item.level <= character.level
    && !excludedIds.has(item.id) && (lockedIds.has(item.id) || !groupExcluded(item))
    && (!allow || allow.has(item.id)));
  const eligible = allowed.filter(item => !needsKnownPrices || itemPrice(item, request) !== undefined);
  const indexOf = new Map(eligible.map((item, index) => [item.id, index]));

  // ---- Stat vector layout -------------------------------------------------
  const keyIndex = new Map<string, number>();
  const key = (name: string) => { let index = keyIndex.get(name); if (index === undefined) keyIndex.set(name, index = keyIndex.size); return index; };
  const conditionKeys = (condition?: ItemCondition) => { if (!condition) return; if (condition.stat) key(condition.stat); condition.children?.forEach(conditionKeys); };
  for (const name of [...CHARACTER_STATS, 'actionPoints', 'movementPoints', 'maxSummonedCreaturesBoost', 'magicFind', 'weight', 'hitPoints',
    'level', 'classId', 'initiative', 'tackleBlock', 'tackleEvade', 'DodgeApLostProbability', 'DodgeMpLostProbability', 'apReduction', 'mpReduction',
    'damagePercent', 'setBonusCount', 'maxSetPieces', 'setBonus', 'activeSetCount', 'criticalHit', ...Object.keys(STAT_CAPS)]) key(name);
  for (const item of eligible) { Object.keys(item.stats).forEach(key); conditionKeys(item.conditions); }
  const setById = new Map(catalog.sets.map(set => [set.id, set]));
  const usedSets = [...new Set(eligible.map(item => item.setId).filter((id): id is number => !!id))];
  for (const id of usedSets) for (const bonus of setById.get(id)?.bonuses || []) Object.keys(bonus.stats).forEach(key);
  for (const constraint of request.constraints) if (constraint.statKey) key(constraint.statKey);
  const K = keyIndex.size;
  const keys = [...keyIndex.keys()];
  const I = Object.fromEntries(keys.map((name, index) => [name, index])) as Record<string, number>;

  type Sparse = { idx: Int32Array; val: Float64Array };
  const sparse = (stats: Stats): Sparse => {
    const entries = Object.entries(stats).filter(([, value]) => Number.isFinite(value) && value !== 0);
    return { idx: Int32Array.from(entries.map(([name]) => key(name))), val: Float64Array.from(entries.map(([, value]) => value)) };
  };
  const compileCondition = (condition: ItemCondition): (v: Float64Array) => boolean => {
    if (condition.kind === 'and') { const children = (condition.children || []).map(compileCondition); return v => children.every(child => child(v)); }
    if (condition.kind === 'or') { const children = (condition.children || []).map(compileCondition); return v => children.some(child => child(v)); }
    if (condition.kind === 'stat' && condition.stat) {
      const index = I[condition.stat], bound = condition.value ?? 0;
      switch (condition.operator) {
        case '>': return v => v[index] > bound;
        case '<': return v => v[index] < bound;
        case '>=': return v => v[index] >= bound;
        case '<=': return v => v[index] <= bound;
        case '=': return v => v[index] === bound;
        case '!=': return v => v[index] !== bound;
      }
    }
    return () => false;
  };
  const itemStats = eligible.map(item => sparse(item.stats));
  const setSlot = new Map(usedSets.map((id, index) => [id, index]));
  const itemSet = Int32Array.from(eligible, item => item.setId ? setSlot.get(item.setId)! : -1);
  const itemCost = Float64Array.from(eligible, item => {
    if (request.prices.mode === 'remaining' && request.prices.ownedItemIds.includes(item.id)) return 0;
    const value = request.prices.values[String(item.id)] ?? request.prices.automaticValues?.[String(item.id)];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : NaN;
  });
  const itemCondition = eligible.map(item => item.conditions ? compileCondition(item.conditions) : null);
  const itemWarned = Uint8Array.from(eligible, item => item.dataWarnings?.length ? 1 : 0);
  const itemUnsupported = Uint8Array.from(eligible, item => item.unsupportedEffects?.length ? 1 : 0);
  const itemPrysma = Uint8Array.from(eligible, item => item.typeId === PRYSMARADITE ? 1 : 0);
  // tier[set][count] is the active bonus with that many pieces equipped.
  const setTiers = usedSets.map(id => {
    const set = setById.get(id);
    return Array.from({ length: 17 }, (_, count) => {
      const bonus = set?.bonuses.filter(entry => entry.count <= count).sort((a, b) => b.count - a.count)[0];
      return bonus ? { stats: sparse(bonus.stats) } : null;
    });
  });
  const exoCost = (exo: ExoStat) => {
    if (request.prices.mode === 'remaining' && request.prices.ownedExos?.includes(exo)) return 0;
    const value = request.prices.exoCosts?.[exo] ?? request.prices.automaticExoCosts?.[exo];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : NaN;
  };
  const exoMasks = exoConfigurations.map(configuration => configuration.reduce((mask, exo) => mask | EXO_BITS[exo], 0));
  const exoCosts = exoConfigurations.map(configuration => configuration.reduce((sum, exo) => sum + exoCost(exo), 0));

  const base = new Float64Array(K);
  const baseStats: Stats = { actionPoints: character.level >= 100 ? 7 : 6, movementPoints: 3, maxSummonedCreaturesBoost: 1, magicFind: 100, weight: 1000, hitPoints: 50 + character.level * 5 };
  for (const stats of [baseStats, automatic ? {} : character.baseStats, character.scrollStats || {}]) {
    for (const [name, value] of Object.entries(stats)) if (Number.isFinite(value)) base[key(name)] += value;
  }
  base[I.level] = character.level;
  base[I.classId] = character.classId;
  const allocIndex = Int32Array.from(CHARACTER_STATS, name => I[name]);
  // Invalid scrolls (or manual points) invalidate every build, as in evaluateBuild.
  const characterViolations = getCharacterAllocation({ ...character, baseStats: automatic ? {} : character.baseStats }).violations.length;
  const capEntries = Object.entries(STAT_CAPS).map(([name, cap]) => [I[name], cap] as const);

  // ---- Constraints ----------------------------------------------------------
  const spells = new Map(catalog.spells.map(spell => [spell.id, spell]));
  const ranks = [...new Set(request.constraints.map(constraint => constraint.priority))].sort((a, b) => a - b);
  const weights = request.constraints.map(constraint => ranks.length - ranks.indexOf(constraint.priority));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const needsStatsObject = request.constraints.some(constraint => constraint.kind === 'spell' || constraint.kind === 'weapon');

  // ---- Working state of one evaluation --------------------------------------
  const eq = new Float64Array(K);
  const v = new Float64Array(K);
  const setCounts = new Int32Array(usedSets.length);
  const touchedSets: number[] = [];
  let eqCost = 0, eqViolations = 0, eqUnsupported = false;
  const eqConditions: ((v: Float64Array) => boolean)[] = [];
  let weaponIndex = -1;

  /** Sums gear and set bonuses of `items` into `eq`; independent of allocation and exos. */
  const sumEquipment = (items: Int32Array) => {
    eq.fill(0);
    eqCost = 0; eqViolations = 0; eqUnsupported = false;
    eqConditions.length = 0; touchedSets.length = 0;
    let prysma = 0;
    weaponIndex = items[WEAPON_SLOT];
    for (let slot = 0; slot < 16; slot += 1) {
      const item = items[slot];
      if (item < 0) continue;
      const stats = itemStats[item];
      for (let k = 0; k < stats.idx.length; k += 1) eq[stats.idx[k]] += stats.val[k];
      eqCost += itemCost[item];
      eqViolations += itemWarned[item];
      if (itemUnsupported[item]) eqUnsupported = true;
      prysma += itemPrysma[item];
      const condition = itemCondition[item];
      if (condition) eqConditions.push(condition);
      const set = itemSet[item];
      if (set >= 0) { if (setCounts[set]++ === 0) touchedSets.push(set); }
    }
    if (prysma > 1) eqViolations += 1;
    let bonusCount = 0, maxPieces = 0, active = 0;
    for (const set of touchedSets) {
      const count = setCounts[set];
      setCounts[set] = 0;
      maxPieces = Math.max(maxPieces, count);
      if (count > 1) { bonusCount += count - 1; active += 1; }
      const tier = setTiers[set][count];
      if (tier) for (let k = 0; k < tier.stats.idx.length; k += 1) eq[tier.stats.idx[k]] += tier.stats.val[k];
    }
    eq[I.setBonusCount] += bonusCount; eq[I.setBonus] += bonusCount;
    eq[I.maxSetPieces] += maxPieces; eq[I.activeSetCount] += active;
  };

  const applyDerived = (target: Float64Array) => {
    const strength = target[I.strength], agility = target[I.agility], chance = target[I.chance], wisdom = target[I.wisdom];
    target[I.hitPoints] += target[I.vitality];
    target[I.initiative] += strength + target[I.intelligence] + chance + agility;
    target[I.magicFind] += Math.floor(Math.max(0, chance) / 10);
    target[I.weight] += Math.max(0, strength) * 5;
    const agilityBonus = Math.floor(Math.max(0, agility) / 10), wisdomBonus = Math.floor(Math.max(0, wisdom) / 10);
    target[I.tackleBlock] += agilityBonus; target[I.tackleEvade] += agilityBonus;
    target[I.DodgeApLostProbability] += wisdomBonus; target[I.DodgeMpLostProbability] += wisdomBonus;
    target[I.apReduction] += wisdomBonus; target[I.mpReduction] += wisdomBonus;
  };

  const statsObject = (): Stats => { const stats: Stats = {}; for (let k = 0; k < K; k += 1) stats[keys[k]] = v[k]; return stats; };
  const spellCache = new Map<number, SpellDamage>();

  /** Completes `eq` with base, allocation and one exo mask. Result in `out`. */
  const out = { soft: 0, penalty: 0, valid: false };
  const finish = (alloc: Int32Array, exoMask: number, cost: number) => {
    for (let k = 0; k < K; k += 1) v[k] = base[k] + eq[k];
    if (automatic) for (let s = 0; s < 6; s += 1) v[allocIndex[s]] += alloc[s];
    if (exoMask & 1) v[I.actionPoints] += 1;
    if (exoMask & 2) v[I.movementPoints] += 1;
    applyDerived(v);
    let violations = eqViolations + characterViolations;
    for (const condition of eqConditions) if (!condition(v)) violations += 1;
    for (const [index, cap] of capEntries) if (v[index] > cap) v[index] = cap;
    let stats: Stats | null = null;
    spellCache.clear();
    let weaponDamage: ReturnType<typeof calculateWeaponDamage> | undefined;
    let numerator = 0, strictPenalty = 0;
    for (let c = 0; c < request.constraints.length; c += 1) {
      const constraint = request.constraints[c];
      let value: number | null = null;
      let supported = true;
      if (constraint.kind === 'stat') {
        value = v[I[constraint.statKey || '']] + (constraint.includePower && canIncludePower(constraint) ? v[I.damagePercent] : 0);
        if (constraint.includePower && !canIncludePower(constraint)) supported = false;
      } else if (constraint.kind === 'price') {
        value = Number.isNaN(cost) ? null : cost; supported = value !== null;
      } else {
        stats ??= needsStatsObject ? statsObject() : {};
        ({ value, supported } = combatValue(constraint, stats));
        if (constraint.kind === 'weapon' && constraint.metric !== 'criticalChance' && weaponIndex >= 0 && eligible[weaponIndex].slotType === 'weapon') {
          weaponDamage ??= calculateWeaponDamage(eligible[weaponIndex], stats, request.target, character.level);
          supported = weaponDamage.supported;
          value = (constraint.mode === 'critical' ? weaponDamage.critical : weaponDamage.normal)?.[constraint.metric ?? 'average'] ?? null;
          if (value === null) supported = false;
          if ((constraint.turnOffset ?? 0) !== 0) supported = false;
          if (constraint.strict && eqUnsupported) supported = false;
        }
      }
      const result = scoreCriterion(constraint, supported ? value : null);
      numerator += weights[c] * result.score;
      if (constraint.strict && (!supported || !result.satisfied)) {
        violations += 1;
        if (!supported || value === null) strictPenalty += 10;
        else {
          const gap = constraint.relation === 'atMost' ? value - constraint.target : constraint.target - value;
          strictPenalty += Math.min(10, Math.max(0, gap) / Math.max(1, constraint.target));
        }
      }
    }
    out.soft = weightSum ? 100 * numerator / weightSum : 0;
    out.valid = violations === 0;
    out.penalty = out.valid ? 0 : violations + strictPenalty;
  };

  /** Spell and weapon objectives, mirroring evaluateBuild. Weapon damage is completed by the caller. */
  const combatValue = (constraint: Constraint, stats: Stats): { value: number | null; supported: boolean } => {
    if (constraint.kind === 'spell') {
      const spell = spells.get(constraint.spellId ?? 0);
      if (!spell) return { value: null, supported: false };
      if (constraint.metric === 'criticalChance') {
        const value = calculateSpellCriticalChance(spell, stats, character.level);
        let supported = value !== null && !spell.dataWarnings?.length && (!spell.classIds.length || spell.classIds.includes(character.classId));
        if (constraint.strict && eqUnsupported) supported = false;
        return { value, supported };
      }
      let damage = constraint.scenario ? undefined : spellCache.get(spell.id);
      if (!damage) { damage = calculateSpellDamage(spell, stats, request.target, character.level, { catalog, scenario: constraint.scenario }); if (!constraint.scenario) spellCache.set(spell.id, damage); }
      let supported = damage.supported && (!spell.classIds.length || spell.classIds.includes(character.classId));
      const turn = damage.turns.find(entry => entry.turn === (constraint.turnOffset ?? 0));
      if (!turn?.available) supported = false;
      const value = (constraint.mode === 'critical' ? turn?.critical : turn?.normal)?.[constraint.metric ?? 'average'] ?? null;
      if (value === null || (constraint.strict && eqUnsupported)) supported = false;
      return { value, supported };
    }
    const weapon = weaponIndex >= 0 ? eligible[weaponIndex] : undefined;
    if (!weapon || weapon.slotType !== 'weapon') return { value: null, supported: false };
    if (constraint.metric !== 'criticalChance') return { value: null, supported: true };
    const value = calculateWeaponCriticalChance(weapon, stats, character.level);
    let supported = value !== null && !weapon.dataWarnings?.length;
    if ((constraint.turnOffset ?? 0) !== 0 || (constraint.strict && eqUnsupported)) supported = false;
    return { value, supported };
  };

  // Valid beats invalid; among invalid, smaller penalty; then score. Folded into one annealing energy.
  const fitness = (soft: number, penalty: number) => soft - HARD_WEIGHT * penalty;
  const result = { soft: 0, penalty: 0, valid: false, exo: 0, fitness: 0 };
  let evaluated = 0, feasible = 0;
  /** Scores items+allocation under every permitted exo combination, offers each valid one as a winner and keeps the best. Call sumEquipment first. */
  const score = (items: Int32Array, alloc: Int32Array) => {
    let best = -1;
    for (let e = 0; e < exoMasks.length; e += 1) {
      evaluated += 1;
      finish(alloc, exoMasks[e], eqCost + exoCosts[e]);
      if (out.valid) { feasible += 1; offerWinner(items, alloc, e, out.soft); }
      const better = best < 0 || (out.valid !== result.valid ? out.valid
        : !out.valid && Math.abs(out.penalty - result.penalty) > 1e-6 ? out.penalty < result.penalty : out.soft > result.soft);
      if (better) { best = e; result.soft = out.soft; result.penalty = out.penalty; result.valid = out.valid; }
    }
    result.exo = best;
    result.fitness = fitness(result.soft, result.penalty);
  };

  // ---- Allocation -----------------------------------------------------------
  const weaponDamageObjective = request.constraints.some(criterion => criterion.kind === 'weapon' && criterion.metric !== 'criticalChance');
  const preferredStats = allocationPreferences(catalog, request);
  const weaponPreferences = new Map<number, Stats>();
  const preferencesFor = (items: Int32Array): Stats => {
    const weapon = items[WEAPON_SLOT];
    if (!weaponDamageObjective || weapon < 0) return preferredStats;
    let preferences = weaponPreferences.get(weapon);
    if (!preferences) weaponPreferences.set(weapon, preferences = allocationPreferences(catalog, request, eligible[weapon]));
    return preferences;
  };
  const allocationCost = (stats: Stats) => Object.entries(stats).reduce((sum, [name, value]) => sum + characterPointCost(name, value), 0);
  const mergeMinimums = (left: Stats, right: Stats): Stats => {
    const merged = { ...left };
    for (const [name, value] of Object.entries(right)) merged[name] = Math.max(merged[name] || 0, value);
    return merged;
  };
  const baseline = new Float64Array(K);
  /** Invested points needed for prerequisites and strict thresholds of the gear in `eq`. */
  const minimumStats = (items: Int32Array): Stats => {
    for (let k = 0; k < K; k += 1) baseline[k] = base[k] + eq[k];
    applyDerived(baseline);
    const forTarget = (name: string, target: number): Stats => {
      const index = I[name];
      const deficit = target - (index === undefined ? 0 : baseline[index]);
      if (deficit <= 0) return {};
      if (CHARACTER_STATS.includes(name as typeof CHARACTER_STATS[number])) return { [name]: Math.ceil(deficit) };
      const derived = derivedAllocation[name];
      if (derived) {
        const remainder = derived.factor === 0.1 ? Math.max(0, baseline[I[derived.stat]]) % 10 : 0;
        return { [derived.stat]: Math.max(0, Math.ceil(deficit / derived.factor) - remainder) };
      }
      if (name === 'initiative') {
        const preferences = preferencesFor(items);
        const stat = ['strength', 'intelligence', 'chance', 'agility'].sort((a, b) => (preferences[b] || 0) - (preferences[a] || 0))[0];
        return { [stat]: Math.ceil(deficit) };
      }
      return {};
    };
    const fromCondition = (condition: ItemCondition): Stats => {
      if (condition.kind === 'and') return (condition.children || []).reduce((sum, child) => mergeMinimums(sum, fromCondition(child)), {});
      if (condition.kind === 'or') return (condition.children || []).map(fromCondition).sort((a, b) => allocationCost(a) - allocationCost(b))[0] || {};
      if (condition.kind === 'stat' && condition.stat && ['>', '>=', '='].includes(condition.operator || '')) {
        return forTarget(condition.stat, (condition.value || 0) + (condition.operator === '>' ? 1 : 0));
      }
      return {};
    };
    let minimums: Stats = {};
    for (let slot = 0; slot < 16; slot += 1) {
      const condition = items[slot] >= 0 ? eligible[items[slot]].conditions : undefined;
      if (condition) minimums = mergeMinimums(minimums, fromCondition(condition));
    }
    for (const criterion of request.constraints) if (criterion.kind === 'stat' && criterion.strict && criterion.relation === 'atLeast' && criterion.statKey) {
      const power = criterion.includePower && canIncludePower(criterion) ? baseline[I.damagePercent] : 0;
      minimums = mergeMinimums(minimums, forTarget(criterion.statKey, criterion.target - power));
    }
    return minimums;
  };
  // Greedy allocation walks point by point: memoise it per (preferences, minimums), both stable during a search.
  const allocationCache = new WeakMap<Stats, Map<string, Stats>>();
  const greedyAllocation = (preferences: Stats, minimums: Stats): Stats => {
    let cache = allocationCache.get(preferences);
    if (!cache) allocationCache.set(preferences, cache = new Map());
    const id = CHARACTER_STATS.map(name => minimums[name] || 0).join('.');
    let allocation = cache.get(id);
    if (!allocation) {
      if (cache.size >= 5_000) cache.clear();
      cache.set(id, allocation = allocateCharacterStats(character, preferences, minimums));
    }
    return allocation;
  };
  const writeAlloc = (alloc: Int32Array, stats: Stats) => { for (let s = 0; s < 6; s += 1) alloc[s] = stats[CHARACTER_STATS[s]] || 0; };
  const variedPreferences = (preferences: Stats): Stats => {
    if (random() < 0.2) return { [CHARACTER_STATS[Math.floor(random() * CHARACTER_STATS.length)]]: 1 };
    const top = Math.max(...Object.values(preferences));
    return Object.fromEntries(CHARACTER_STATS.map(stat => [stat, (preferences[stat] || top * 0.005) * (0.2 + random() * 4.8)]));
  };
  /** Requires sumEquipment(items) first. */
  const assignAllocation = (items: Int32Array, alloc: Int32Array, greedy: boolean) => {
    if (!automatic) return;
    const minimums = minimumStats(items);
    const preferences = preferencesFor(items);
    writeAlloc(alloc, !greedy && random() < 0.15 ? minimums
      : greedy ? greedyAllocation(preferences, minimums) : allocateCharacterStats(character, variedPreferences(preferences), minimums, 10));
  };
  /** Re-allocates only when the gear's prerequisites/strict thresholds are no longer met. Requires sumEquipment(items). */
  const repairAllocation = (items: Int32Array, alloc: Int32Array) => {
    if (!automatic) return;
    const minimums = minimumStats(items);
    for (let s = 0; s < 6; s += 1) if (alloc[s] < (minimums[CHARACTER_STATS[s]] || 0)) {
      writeAlloc(alloc, greedyAllocation(preferencesFor(items), minimums));
      return;
    }
  };
  const budget = (character.level - 1) * 5;
  const spentPoints = (alloc: Int32Array) => { let sum = 0; for (let s = 0; s < 6; s += 1) sum += characterPointCost(CHARACTER_STATS[s], alloc[s]); return sum; };
  const steps = [1, 5, 10, 25, 50, 100];
  const mutateAllocation = (items: Int32Array, alloc: Int32Array) => {
    if (random() < 0.25) { assignAllocation(items, alloc, false); return; }
    const donors: number[] = [];
    for (let s = 0; s < 6; s += 1) if (alloc[s] > 0) donors.push(s);
    if (!donors.length) { assignAllocation(items, alloc, false); return; }
    const donor = donors[Math.floor(random() * donors.length)];
    let receiver = Math.floor(random() * 5);
    if (receiver >= donor) receiver += 1;
    alloc[donor] -= Math.min(alloc[donor], steps[Math.floor(random() * steps.length)]);
    // Unspent points are legal and may be required by upper-bound constraints.
    if (random() < 0.15) return;
    let remaining = budget - spentPoints(alloc);
    const name = CHARACTER_STATS[receiver];
    while (remaining > 0) {
      const nextCost = characterPointCost(name, alloc[receiver] + 1) - characterPointCost(name, alloc[receiver]);
      if (nextCost > remaining) break;
      alloc[receiver] += 1;
      remaining -= nextCost;
    }
    // Vitality always costs one point and absorbs a remainder smaller than a stat tier.
    if (remaining > 0) alloc[0] += remaining;
  };

  // ---- Pools ----------------------------------------------------------------
  const ranking = new Map(eligible.map(item => [item.id, itemHeuristic(item, request, catalog)]));
  const pools: Int32Array[] = SLOTS.map(slot => {
    const locked = request.filters.lockedSlots[slot];
    if (locked) {
      const index = indexOf.get(locked);
      if (index === undefined || eligible[index].slotType !== slotType(slot)) {
        throw new SearchConfigurationError('Un objet verrouillé ne respecte pas les filtres, le niveau ou les prix requis.');
      }
      return Int32Array.of(index);
    }
    const pool = eligible.filter(item => item.slotType === slotType(slot) && !groupExcluded(item) && !item.dataWarnings?.length)
      .sort((a, b) => (ranking.get(b.id) || 0) - (ranking.get(a.id) || 0));
    if (needsKnownPrices && slotType(slot) !== 'dofus' && !pool.length && allowed.some(item => item.slotType === slotType(slot))) {
      throw new SearchConfigurationError('Des prix manquent pour une catégorie d’équipement. Renseignez-les ou retirez le caractère obligatoire du budget.');
    }
    return Int32Array.from(pool, item => indexOf.get(item.id)!);
  });
  const setPieces = new Map<number, number[]>();
  for (let index = 0; index < eligible.length; index += 1) {
    const set = itemSet[index];
    if (set >= 0 && !groupExcluded(eligible[index]) && !itemWarned[index]) setPieces.set(set, [...(setPieces.get(set) || []), index]);
  }
  const mutableSlots = SLOTS.map((slot, index) => index).filter(index => !request.filters.lockedSlots[SLOTS[index]]
    && (pools[index].length > 1 || (slotType(SLOTS[index]) === 'dofus' && pools[index].length > 0)));
  const allocationMutable = automatic && character.level > 1;
  const canMutate = mutableSlots.length > 0 || allocationMutable;

  const shareable = (item: number) => eligible[item].slotType === 'ring' && !eligible[item].setId;
  const isUsed = (items: Int32Array, slot: number, item: number) => {
    if (shareable(item)) return false;
    for (let other = 0; other < 16; other += 1) if (other !== slot && items[other] === item) return true;
    return false;
  };
  /** Biased towards the heuristic's favourites, but every pooled item stays reachable. */
  const pick = (slot: number, items: Int32Array, greedy = false): number => {
    const pool = pools[slot];
    if (greedy) { for (const item of pool) if (!isUsed(items, slot, item)) return item; return -1; }
    if (slotType(SLOTS[slot]) === 'dofus' && random() < 0.1) return -1;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const r = random();
      const item = pool[Math.floor(pool.length * (random() < 0.7 ? r * r : r))];
      if (item !== undefined && !isUsed(items, slot, item)) return item;
    }
    return -1;
  };

  const toBuild = (items: Int32Array, alloc: Int32Array, exo: number): Build => {
    const slots: Build['slots'] = {};
    SLOTS.forEach((slot, index) => { if (items[index] >= 0) slots[slot] = eligible[items[index]].id; });
    const build: Build = { slots, exoBonuses: exo >= 0 ? [...exoConfigurations[exo]] : [] };
    if (automatic) build.baseStats = Object.fromEntries(CHARACTER_STATS.map((name, s) => [name, alloc[s]]).filter(([, value]) => value));
    return build;
  };

  // ---- Exact winners ----------------------------------------------------------
  const winners = new Map<string, { evaluation: BuildEvaluation; items: Int32Array; alloc: Int32Array }>();
  const rejected = new Set<string>();
  let worstWinner = -Infinity;
  const gearKey = (items: Int32Array, exo: number) => {
    const ids: number[] = [];
    for (let slot = 0; slot < 16; slot += 1) if (items[slot] >= 0 && slotType(SLOTS[slot]) !== 'dofus') ids.push(eligible[items[slot]].id);
    return `${ids.sort((a, b) => a - b).join('.')}|${exo >= 0 ? [...exoConfigurations[exo]].sort().join('.') : ''}`;
  };
  /** One exact result per gear set: dofus/trophy variants of the same gear would otherwise fill the list. */
  function offerWinner(items: Int32Array, alloc: Int32Array, exo: number, soft: number) {
    if (winners.size >= MAX_WINNERS && soft <= worstWinner) return;
    const gear = gearKey(items, exo);
    const previous = winners.get(gear);
    if (previous && previous.evaluation.score >= soft - 1e-9) return;
    const build = toBuild(items, alloc, exo);
    const full = `${gear}|${Object.values(build.slots).join('.')}|${Object.values(build.baseStats || {}).join('.')}`;
    if (rejected.has(full)) return;
    const evaluation = evaluateBuild(catalog, request, build);
    if (!evaluation.valid) { if (rejected.size < 10_000) rejected.add(full); return; }
    if (previous && previous.evaluation.score >= evaluation.score) return;
    winners.set(gear, { evaluation, items: items.slice(), alloc: alloc.slice() });
    if (winners.size > MAX_WINNERS) {
      const worst = [...winners.entries()].sort((a, b) => a[1].evaluation.score - b[1].evaluation.score)[0];
      winners.delete(worst[0]);
    }
    worstWinner = winners.size >= MAX_WINNERS ? Math.min(...[...winners.values()].map(entry => entry.evaluation.score)) : -Infinity;
  }

  // ---- Annealing state ----------------------------------------------------------
  const current = new Int32Array(16).fill(-1), currentAlloc = new Int32Array(6);
  const next = new Int32Array(16), nextAlloc = new Int32Array(6);
  const best = new Int32Array(16), bestAlloc = new Int32Array(6);
  let currentFitness = -Infinity, bestFitness = -Infinity, sinceBest = 0;

  const evaluateInto = (items: Int32Array, alloc: Int32Array) => {
    sumEquipment(items);
    score(items, alloc);
    if (result.fitness > bestFitness) { bestFitness = result.fitness; best.set(items); bestAlloc.set(alloc); sinceBest = 0; }
    return result.fitness;
  };
  const adoptIfBetter = (items: Int32Array, alloc: Int32Array, force = false) => {
    const fitness = evaluateInto(items, alloc);
    if (force || fitness > currentFitness) { current.set(items); currentAlloc.set(alloc); currentFitness = fitness; }
  };
  const makeSeed = (items: Int32Array, alloc: Int32Array, greedy: boolean) => {
    items.fill(-1);
    SLOTS.forEach((slot, index) => { const locked = request.filters.lockedSlots[slot]; if (locked) items[index] = indexOf.get(locked)!; });
    for (let slot = 0; slot < 16; slot += 1) if (items[slot] < 0) items[slot] = pick(slot, items, greedy);
    if (automatic) { sumEquipment(items); assignAllocation(items, alloc, greedy); }
  };
  const fromBuild = (build: Build, items: Int32Array, alloc: Int32Array) => {
    makeSeed(items, alloc, true);
    SLOTS.forEach((slot, index) => {
      const id = build.slots[slot];
      const item = id === undefined ? undefined : indexOf.get(id);
      if (item !== undefined && !request.filters.lockedSlots[slot] && eligible[item].slotType === slotType(slot)) items[index] = item;
    });
    if (automatic) {
      if (build.baseStats && getCharacterAllocation({ ...character, baseStats: build.baseStats }).valid) writeAlloc(alloc, build.baseStats);
      else { sumEquipment(items); assignAllocation(items, alloc, true); }
    }
  };

  makeSeed(next, nextAlloc, true);
  adoptIfBetter(next, nextAlloc, true);
  if (automatic) {
    sumEquipment(next);
    writeAlloc(nextAlloc, minimumStats(next));
    adoptIfBetter(next, nextAlloc);
  }
  if (request.initialBuild) { fromBuild(request.initialBuild, next, nextAlloc); adoptIfBetter(next, nextAlloc); }

  const T0 = 4, T1 = 0.02, STALL = 4_000;
  const restart = () => {
    const elites = [...winners.values()];
    const roll = random();
    if (roll < 0.35) { next.set(best); nextAlloc.set(bestAlloc); }
    else if (roll < 0.7 && elites.length) { const elite = elites[Math.floor(random() * elites.length)]; next.set(elite.items); nextAlloc.set(elite.alloc); }
    else makeSeed(next, nextAlloc, false);
    // Kick: a few random slots so a restart from an elite does not fall straight back into it.
    if (roll < 0.7) for (let k = 0; k < 3 && mutableSlots.length; k += 1) {
      const slot = mutableSlots[Math.floor(random() * mutableSlots.length)];
      next[slot] = pick(slot, next);
    }
    sumEquipment(next);
    repairAllocation(next, nextAlloc);
    const fitness = evaluateInto(next, nextAlloc);
    current.set(next); currentAlloc.set(nextAlloc); currentFitness = fitness;
    sinceBest = 0;
  };

  /** One annealing proposal at the given temperature. */
  const step = (temperature: number) => {
    next.set(current); nextAlloc.set(currentAlloc);
    const changeAllocation = allocationMutable && (!mutableSlots.length || random() < 0.2);
    if (changeAllocation) {
      sumEquipment(next);
      mutateAllocation(next, nextAlloc);
    } else {
      const moves = random() < 0.2 ? 2 : 1;
      let placed = -1;
      for (let m = 0; m < moves; m += 1) {
        const slot = mutableSlots[Math.floor(random() * mutableSlots.length)];
        next[slot] = placed = pick(slot, next);
      }
      // Whole set transitions, which one-piece moves can only reach through bad intermediate states.
      if (placed >= 0 && itemSet[placed] >= 0 && random() < 0.15) {
        for (const piece of setPieces.get(itemSet[placed]) || []) {
          if (next.includes(piece)) continue;
          const slot = mutableSlots.find(index => slotType(SLOTS[index]) === eligible[piece].slotType && (next[index] < 0 || itemSet[next[index]] !== itemSet[placed]));
          if (slot !== undefined && pools[slot].includes(piece)) next[slot] = piece;
        }
      }
      sumEquipment(next);
      // A weapon objective follows each candidate's damage elements.
      if (automatic && weaponDamageObjective && next[WEAPON_SLOT] !== current[WEAPON_SLOT]) assignAllocation(next, nextAlloc, true);
      else repairAllocation(next, nextAlloc);
    }
    score(next, nextAlloc);
    const fitness = result.fitness;
    if (fitness > bestFitness) { bestFitness = fitness; best.set(next); bestAlloc.set(nextAlloc); sinceBest = 0; } else sinceBest += 1;
    if (fitness >= currentFitness || random() < Math.exp((fitness - currentFitness) / temperature)) {
      current.set(next); currentAlloc.set(nextAlloc); currentFitness = fitness;
    }
    if (sinceBest >= STALL) restart();
  };

  return {
    canMutate,
    /** Runs up to `evals` proposals; `progress` (0..1) is the share of the search budget already spent. */
    run(evals: number, progress: number) {
      if (!canMutate) return;
      const temperature = T0 * Math.pow(T1 / T0, Math.min(1, Math.max(0, progress)));
      for (let k = 0; k < evals; k += 1) step(temperature);
    },
    /** Island migration: start from another island's best build when it beats ours. */
    adopt(build: Build) {
      fromBuild(build, next, nextAlloc);
      adoptIfBetter(next, nextAlloc);
    },
    /** Fast-model verdict for an exact build (consistency checks against evaluateBuild). */
    inspect(build: Build) {
      const items = new Int32Array(16).fill(-1), alloc = new Int32Array(6);
      SLOTS.forEach((slot, index) => { const item = indexOf.get(build.slots[slot] ?? -1); if (item !== undefined) items[index] = item; });
      writeAlloc(alloc, build.baseStats || {});
      sumEquipment(items);
      const mask = (build.exoBonuses || []).reduce((sum, exo) => sum | EXO_BITS[exo], 0);
      finish(alloc, mask, eqCost + (build.exoBonuses || []).reduce((sum, exo) => sum + exoCost(exo), 0));
      return { soft: out.soft, valid: out.valid };
    },
    best(): Build | null { return bestFitness > -Infinity ? toBuild(best, bestAlloc, -1) : null; },
    bestFitness: () => bestFitness,
    snapshot(): SearchSnapshot {
      return { evaluated, feasible, results: [...winners.values()].map(entry => entry.evaluation).sort((a, b) => b.score - a.score) };
    },
  };
}
export type Search = ReturnType<typeof createSearch>;
