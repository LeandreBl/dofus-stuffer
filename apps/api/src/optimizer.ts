import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import {
  allocateCharacterStats, calculateEquipmentMaluses, calculateSpellDamage, getSpellElements, canIncludePower, CHARACTER_STATS, characterPointCost, evaluateBuild, getCharacterAllocation, getSpellLevel, getStatConstraintValue, SLOTS, slotType,
  type Build, type BuildEvaluation, type Catalog, type EquipmentItem,
  type ExoStat, type ItemCondition, type JobProgress, type OptimizationRequest, type Slot, type Stats,
} from '@dofus/shared';

export interface SearchUpdate { progress: JobProgress; results: BuildEvaluation[]; }
export interface SearchResult extends SearchUpdate { cancelled: boolean; stopReason: 'time' | 'candidates' | 'fixed' | 'cancelled'; }
export interface SearchHooks {
  /** Called at most three times a second; returning true cancels the search. */
  onProgress: (update: SearchUpdate) => Promise<boolean>;
}
export class SearchConfigurationError extends Error {}

function randomGenerator(seed: number) {
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

function itemHeuristic(item: EquipmentItem, request: OptimizationRequest, catalog: Catalog): number {
  let score = item.level / 2_000 - calculateEquipmentMaluses(catalog, [item.stats]).penalty / 100;
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
      } else {
        for (const [key, value] of Object.entries(item.stats)) {
          if (/strength|intelligence|chance|agility|power|damage|critical/i.test(key)) score += weight * value / 250;
        }
        if (constraint.kind === 'weapon' && item.weapon) {
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

interface Candidate { evaluation: BuildEvaluation; penalty: number; }
const cloneBuild = (build: Build): Build => ({ slots: { ...build.slots }, exoBonuses: [...(build.exoBonuses || [])], ...(build.baseStats ? { baseStats: { ...build.baseStats } } : {}) });
const exoSignature = (build: Build) => [...(build.exoBonuses || [])].sort().join('.');
const gearSignature = (build: Build) => `${SLOTS.map(slot => build.slots[slot] || 0).join('.')}|${exoSignature(build)}`;
const signature = (build: Build) => `${gearSignature(build)}|${CHARACTER_STATS.map(stat => build.baseStats?.[stat] || 0).join('.')}`;
// Slot permutations do not make a new equipment alternative; retain repeated legal rings.
const equipmentSignature = (build: Build) => `${Object.values(build.slots).filter(id => id !== undefined).sort((a, b) => a! - b!).join('.')}|${exoSignature(build)}`;

const derivedAllocation: Record<string, { stat: string; factor: number }> = {
  hitPoints: { stat: 'vitality', factor: 1 }, magicFind: { stat: 'chance', factor: 0.1 },
  weight: { stat: 'strength', factor: 5 }, tackleBlock: { stat: 'agility', factor: 0.1 },
  tackleEvade: { stat: 'agility', factor: 0.1 },
  DodgeApLostProbability: { stat: 'wisdom', factor: 0.1 }, DodgeMpLostProbability: { stat: 'wisdom', factor: 0.1 },
  apReduction: { stat: 'wisdom', factor: 0.1 }, mpReduction: { stat: 'wisdom', factor: 0.1 },
};
const damageAllocation: Record<number, string> = { 91: 'chance', 92: 'strength', 93: 'agility', 94: 'intelligence', 95: 'strength',
  96: 'chance', 97: 'strength', 98: 'agility', 99: 'intelligence', 100: 'strength' };

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
        const result=calculateSpellDamage(spell,{hitPoints:1050},request.target,request.character.level,{catalog,scenario:criterion.scenario});
        if(result.parameters?.includes('casterHpPercent'))add('vitality',weight);
        else {
          const elements=result.lines.length?[...new Set(result.lines.filter(line=>line.kind!=='push'&&line.kind!=='life').map(line=>line.element))]:getSpellElements(spell,request.character.level,catalog);
          const stats={earth:'strength',neutral:'strength',fire:'intelligence',water:'chance',air:'agility'};
          for(const element of elements)add(stats[element],weight);
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

function penaltyFor(evaluation: BuildEvaluation, request: OptimizationRequest): number {
  if (evaluation.valid) return 0;
  let penalty = evaluation.violations.length;
  for (const constraint of request.constraints.filter(entry => entry.strict)) {
    const measured = evaluation.constraints.find(entry => entry.id === constraint.id);
    if (!measured?.supported || measured.value === null) { penalty += 10; continue; }
    if (measured.satisfied) continue;
    const gap = constraint.relation === 'atMost' ? measured.value - constraint.target : constraint.target - measured.value;
    penalty += Math.min(10, Math.max(0, gap) / Math.max(1, constraint.target));
  }
  return penalty;
}

function better(left: Candidate, right: Candidate): boolean {
  if (left.evaluation.valid !== right.evaluation.valid) return left.evaluation.valid;
  if (!left.evaluation.valid && Math.abs(left.penalty - right.penalty) > 0.000001) return left.penalty < right.penalty;
  return left.evaluation.score > right.evaluation.score;
}

/** Bounded multi-start local search. All displayed candidates pass the exact shared evaluator. */
export async function optimize(catalog: Catalog, request: OptimizationRequest, hooks: SearchHooks): Promise<SearchResult> {
  const started = Date.now();
  const deadline = started + request.seconds * 1_000;
  const random = randomGenerator(request.seed ?? Math.floor(Math.random() * 4_294_967_296));
  const excludedIds = new Set(request.filters.excludedItemIds);
  const excludedTypes = new Set(request.filters.excludedTypeIds);
  const excludedCategories = new Set(request.filters.excludedCategories);
  const allow = request.filters.allowedItemIds ? new Set(request.filters.allowedItemIds) : null;
  const allowedExos = [...new Set(request.filters.allowedExos || [])];
  const needsKnownPrices = request.constraints.some(c => c.kind === 'price' && c.strict);
  const exoConfigurations = allowedExos.reduce<ExoStat[][]>((combinations, bonus) =>
    [...combinations, ...combinations.map(values => [...values, bonus])], [[]])
    .filter(combination => combination.length <= (request.filters.maxExos ?? 2))
    .filter(combination => !needsKnownPrices || combination.every(bonus => (request.prices.exoCosts?.[bonus] ?? request.prices.automaticExoCosts?.[bonus]) !== undefined
      || (request.prices.mode === 'remaining' && request.prices.ownedExos?.includes(bonus))));
  const allowed = catalog.items.filter(item => item.level <= request.character.level
    && !excludedIds.has(item.id) && !excludedTypes.has(item.typeId) && !excludedCategories.has(item.category)
    && (!allow || allow.has(item.id)));
  const eligible = allowed.filter(item => !needsKnownPrices || itemPrice(item, request) !== undefined);
  const byId = new Map(eligible.map(item => [item.id, item]));
  const automatic = request.character.allocationMode === 'automatic';
  const allocationMutable = automatic && request.character.level > 1;
  const preferredStats = allocationPreferences(catalog, request);
  const weaponDamageObjective = request.constraints.some(criterion => criterion.kind === 'weapon' && criterion.metric !== 'criticalChance');
  const weaponPreferences = new Map<number, Stats>();
  const preferencesFor = (build: Build): Stats => {
    const weaponId = build.slots.weapon;
    if (!weaponDamageObjective || !weaponId) return preferredStats;
    let preferences = weaponPreferences.get(weaponId);
    if (!preferences) {
      preferences = allocationPreferences(catalog, request, byId.get(weaponId));
      weaponPreferences.set(weaponId, preferences);
    }
    return preferences;
  };
  const minimumsCache = new Map<string, Stats>();
  const allocationCost = (stats: Stats) => Object.entries(stats).reduce((sum, [key, value]) => sum + characterPointCost(key, value), 0);
  const mergeMinimums = (left: Stats, right: Stats): Stats => {
    const merged = { ...left };
    for (const [key, value] of Object.entries(right)) merged[key] = Math.max(merged[key] || 0, value);
    return merged;
  };
  const minimumStatsForBuild = (build: Build): Stats => {
    const key = gearSignature(build);
    const existing = minimumsCache.get(key);
    if (existing) return existing;
    const baseline = evaluateBuild(catalog, { ...request, constraints: [] }, { ...build, baseStats: {} }).stats;
    const forTarget = (key: string, target: number): Stats => {
      const deficit = target - (baseline[key] || 0);
      if (deficit <= 0) return {};
      if (CHARACTER_STATS.includes(key as typeof CHARACTER_STATS[number])) return { [key]: Math.ceil(deficit) };
      const derived = derivedAllocation[key];
      if (derived) {
        const remainder = derived.factor === 0.1 ? Math.max(0, baseline[derived.stat] || 0) % 10 : 0;
        return { [derived.stat]: Math.max(0, Math.ceil(deficit / derived.factor) - remainder) };
      }
      if (key === 'initiative') {
        const preferences = preferencesFor(build);
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
    for (const id of Object.values(build.slots)) {
      const condition = byId.get(id!)?.conditions;
      if (condition) minimums = mergeMinimums(minimums, fromCondition(condition));
    }
    for (const criterion of request.constraints) if (criterion.kind === 'stat' && criterion.strict
      && criterion.relation === 'atLeast' && criterion.statKey) {
      const power = criterion.includePower && canIncludePower(criterion) ? baseline.damagePercent || 0 : 0;
      minimums = mergeMinimums(minimums, forTarget(criterion.statKey, criterion.target - power));
    }
    if (minimumsCache.size >= 1_000) minimumsCache.delete(minimumsCache.keys().next().value!);
    minimumsCache.set(key, minimums);
    return minimums;
  };
  const variedPreferences = (preferences: Stats): Stats => {
    if (random() < 0.2) return { [CHARACTER_STATS[Math.floor(random() * CHARACTER_STATS.length)]]: 1 };
    return Object.fromEntries(CHARACTER_STATS.map(stat => [stat, (preferences[stat] || Math.max(...Object.values(preferences)) * 0.005) * (0.2 + random() * 4.8)]));
  };
  const assignAllocation = (build: Build, greedy: boolean) => {
    if (automatic) {
      const minimums = minimumStatsForBuild(build);
      const preferences = preferencesFor(build);
      build.baseStats = !greedy && random() < 0.15 ? { ...minimums }
        : allocateCharacterStats(request.character, greedy ? preferences : variedPreferences(preferences), minimums);
    }
  };
  const mutateAllocation = (build: Build) => {
    if (random() < 0.25) { assignAllocation(build, false); return; }
    const allocated = { ...build.baseStats };
    const donors = CHARACTER_STATS.filter(stat => (allocated[stat] || 0) > 0);
    if (!donors.length) { assignAllocation(build, false); return; }
    const donor = donors[Math.floor(random() * donors.length)];
    const receivers = CHARACTER_STATS.filter(stat => stat !== donor);
    const receiver = receivers[Math.floor(random() * receivers.length)];
    const counts = [1, 5, 10, 25, 50, 100];
    allocated[donor] -= Math.min(allocated[donor], counts[Math.floor(random() * counts.length)]);
    // Unspent points are legal and may be required by upper-bound constraints.
    if (random() < 0.15) { build.baseStats = allocated; return; }
    let remaining = (request.character.level - 1) * 5 - allocationCost(allocated);
    while (remaining > 0) {
      const current = allocated[receiver] || 0;
      const nextCost = characterPointCost(receiver, current + 1) - characterPointCost(receiver, current);
      if (nextCost > remaining) break;
      allocated[receiver] = current + 1;
      remaining -= nextCost;
    }
    // Vitality always costs one point and absorbs a remainder smaller than a stat tier.
    if (remaining > 0) allocated.vitality = (allocated.vitality || 0) + remaining;
    build.baseStats = allocated;
  };
  const ranking = new Map(eligible.map(item => [item.id, itemHeuristic(item, request, catalog)]));
  const pools = new Map<Slot, EquipmentItem[]>();
  for (const slot of SLOTS) {
    const locked = request.filters.lockedSlots[slot];
    if (locked) {
      const item = byId.get(locked);
      if (!item || item.slotType !== slotType(slot)) {
        throw new SearchConfigurationError('Un objet verrouillé ne respecte pas les filtres, le niveau ou les prix requis.');
      }
      pools.set(slot, [item]);
    } else {
      pools.set(slot, eligible.filter(item => item.slotType === slotType(slot))
        .sort((a, b) => (ranking.get(b.id) || 0) - (ranking.get(a.id) || 0)));
      if (needsKnownPrices && slotType(slot) !== 'dofus' && !pools.get(slot)?.length
        && allowed.some(item => item.slotType === slotType(slot))) {
        throw new SearchConfigurationError('Des prix manquent pour une catégorie d’équipement. Renseignez-les ou retirez le caractère obligatoire du budget.');
      }
    }
  }
  const mutableSlots = SLOTS.filter(slot => !request.filters.lockedSlots[slot]
    && ((pools.get(slot)?.length || 0) > 1 || (slotType(slot) === 'dofus' && (pools.get(slot)?.length || 0) > 0)));
  const canMutate = mutableSlots.length > 0 || allocationMutable;
  const cache = new Map<string, Candidate>();
  const winners = new Map<string, BuildEvaluation>();
  let evaluated = 0;
  let feasible = 0;
  let cancelled = false;
  let lastReport = 0;
  const configuredMaxCandidates = Number(process.env.MAX_CANDIDATES);
  const maxCandidates = Number.isFinite(configuredMaxCandidates) && configuredMaxCandidates > 0
    ? Math.max(1_000, Math.min(50_000_000, Math.floor(configuredMaxCandidates)))
    : 10_000_000;

  const evaluateSingle = (build: Build): Candidate => {
    const key = signature(build);
    const existing = cache.get(key);
    if (existing) return existing;
    const evaluation = evaluateBuild(catalog, request, build);
    evaluated += 1;
    const candidate = { evaluation, penalty: penaltyFor(evaluation, request) };
    if (cache.size >= 10_000) cache.delete(cache.keys().next().value!);
    cache.set(key, candidate);
    if (evaluation.valid) {
      feasible += 1;
      const equipmentKey = equipmentSignature(build);
      const previous = winners.get(equipmentKey);
      if (!previous || evaluation.score > previous.score) winners.set(equipmentKey, evaluation);
      if (winners.size > 5) {
        const worst = [...winners.entries()].sort((a, b) => a[1].score - b[1].score)[0];
        winners.delete(worst[0]);
      }
    }
    return candidate;
  };

  // There are at most four independent PA/PM combinations. Evaluate all of them
  // for each candidate rather than assigning an exotic bonus to an item.
  const evaluate = (build: Build): Candidate => {
    let best: Candidate | undefined;
    for (const exoBonuses of exoConfigurations) {
      const candidate = evaluateSingle({ ...build, exoBonuses: [...exoBonuses] });
      if (!best || better(candidate, best)) best = candidate;
    }
    return best!;
  };

  const update = (): SearchUpdate => ({
    progress: { percent: Math.min(99, Math.floor((Date.now() - started) / (request.seconds * 10))),
      evaluated, feasible, elapsedMs: Date.now() - started,
      bestScore: winners.size ? Math.max(...[...winners.values()].map(value => value.score)) : null },
    results: [...winners.values()].sort((a, b) => b.score - a.score),
  });

  const pick = (slot: Slot, build: Build, greedy = false): EquipmentItem | undefined => {
    if (!greedy && slotType(slot) === 'dofus' && random() < 0.2) return undefined;
    const used = new Set(Object.entries(build.slots).filter(([key]) => key !== slot).map(([, value]) => value));
    const pool = pools.get(slot) || [];
    const available = pool.filter(item => !used.has(item.id) || (item.slotType === 'ring' && !item.setId));
    if (!available.length) return undefined;
    if (greedy) return available[0];
    const highQuality = random() < 0.75;
    const range = highQuality ? Math.min(40, available.length) : available.length;
    return available[Math.floor(random() * range)];
  };

  const equip = (slot: Slot, item: EquipmentItem | undefined, build: Build) => {
    if (!item) delete build.slots[slot];
    else build.slots[slot] = item.id;
  };

  const makeSeed = (greedy: boolean): Build => {
    const build: Build = { slots: { ...request.filters.lockedSlots }, exoBonuses: [] };
    for (const slot of SLOTS) {
      const item = build.slots[slot] ? byId.get(build.slots[slot]!) : pick(slot, build, greedy);
      equip(slot, item, build);
    }
    assignAllocation(build, greedy);
    return build;
  };

  let current = evaluate(makeSeed(true));
  if (automatic) {
    const minimum = cloneBuild(current.evaluation.build);
    minimum.baseStats = { ...minimumStatsForBuild(minimum) };
    const minimallyInvested = evaluate(minimum);
    if (better(minimallyInvested, current)) current = minimallyInvested;
  }
  if (request.initialBuild) {
    const build = makeSeed(true);
    for (const slot of SLOTS) {
      const id = request.initialBuild.slots[slot];
      if (id && !request.filters.lockedSlots[slot] && byId.get(id)?.slotType === slotType(slot)) build.slots[slot] = id;
    }
    if (automatic) {
      const initialStats = request.initialBuild.baseStats;
      if (initialStats && getCharacterAllocation({ ...request.character, baseStats: initialStats }).valid) build.baseStats = { ...initialStats };
      else assignAllocation(build, true);
    }
    build.exoBonuses = [...(request.initialBuild.exoBonuses || [])];
    const initial = evaluate(build);
    if (better(initial, current)) current = initial;
  }
  let sinceImprovement = 0;
  let iteration = 0;
  while (Date.now() < deadline && evaluated < maxCandidates && canMutate) {
    iteration += 1;
    const next = cloneBuild(current.evaluation.build);
    const changeAllocation = allocationMutable && (!mutableSlots.length || random() < 0.3);
    let item: EquipmentItem | undefined;
    if (changeAllocation) mutateAllocation(next);
    else {
      const slot = mutableSlots[Math.floor(random() * mutableSlots.length)];
      item = pick(slot, next);
      equip(slot, item, next);
    }
    if (!changeAllocation && iteration % 7 === 0 && mutableSlots.length) {
      const otherSlot = mutableSlots[Math.floor(random() * mutableSlots.length)];
      const other = pick(otherSlot, next);
      equip(otherSlot, other, next);
    }
    // Evaluate whole set transitions, which a one-piece hill climb can otherwise miss.
    if (iteration % 23 === 0 && item?.setId) {
      const pieces = eligible.filter(piece => piece.setId === item.setId);
      for (const piece of pieces) {
        if (Object.values(next.slots).includes(piece.id)) continue;
        const matching = mutableSlots.find(key => slotType(key) === piece.slotType && byId.get(next.slots[key] || 0)?.setId !== item.setId);
        if (matching) equip(matching, piece, next);
      }
    }
    // A weapon objective follows each candidate's damage elements. Reallocate
    // when changing weapon so a new element is not rejected with the old stats.
    if (automatic && weaponDamageObjective && next.slots.weapon !== current.evaluation.build.slots.weapon) assignAllocation(next, true);
    const candidate = evaluate(next);
    if (better(candidate, current)) { current = candidate; sinceImprovement = 0; }
    else sinceImprovement += 1;

    if (sinceImprovement >= 150) {
      const elites = [...winners.values()];
      current = elites.length && random() < 0.45
        ? evaluate(cloneBuild(elites[Math.floor(random() * elites.length)].build))
        : evaluate(makeSeed(false));
      sinceImprovement = 0;
    }
    if (iteration % 32 === 0) await yieldToEventLoop();
    if (Date.now() - lastReport >= 350) {
      lastReport = Date.now();
      cancelled = await hooks.onProgress(update());
      if (cancelled) break;
    }
  }
  if (!cancelled) cancelled = await hooks.onProgress(update());
  const final = update();
  final.progress.percent = cancelled ? final.progress.percent : 100;
  return { ...final, cancelled,
    stopReason: cancelled ? 'cancelled' : !canMutate ? 'fixed' : evaluated >= maxCandidates ? 'candidates' : 'time' };
}
