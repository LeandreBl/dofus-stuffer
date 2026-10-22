import type { Catalog, EquipmentItem } from './types.js';

// Forgemagic (smithmagic) model. Weights are the client's effectPowerRate (dofusdb `effects`).
// Ankama never published the odds: FM_MODEL holds the community model (JondoEmu Forgemagic.cs),
// kept as tunable constants so real outcomes can recalibrate it.

/** Rune-able bonus effect id → [stat key, weight of one point, tooltip order (dofusdb effectPriority)]. */
export const FM_EFFECTS: Readonly<Record<number, readonly [string, number, number]>> = {
  111: ['actionPoints', 100, 6700],
  112: ['allDamageBonus', 20, 7400],
  115: ['criticalHit', 10, 6400],
  117: ['range', 51, 7100],
  118: ['strength', 1, 5300],
  119: ['agility', 1, 5900],
  123: ['chance', 1, 5700],
  124: ['wisdom', 3, 6100],
  125: ['vitality', 0.2, 5000],
  126: ['intelligence', 1, 5500],
  128: ['movementPoints', 90, 6900],
  138: ['damagePercent', 2, 6300],
  158: ['weight', 0.25, 9100],
  160: ['DodgeApLostProbability', 7, 13200],
  161: ['DodgeMpLostProbability', 7, 13400],
  174: ['initiative', 0.1, 8900],
  176: ['magicFind', 3, 8700],
  178: ['healBonus', 10, 8500],
  182: ['maxSummonedCreaturesBoost', 30, 7300],
  210: ['earthElementResistPercent', 6, 9500],
  211: ['waterElementResistPercent', 6, 9700],
  212: ['airElementResistPercent', 6, 9800],
  213: ['fireElementResistPercent', 6, 9600],
  214: ['neutralElementResistPercent', 6, 9400],
  220: ['reflectDamage', 5, 9300],
  225: ['trapDamageBonus', 5, 14500],
  226: ['trapDamageBonusPercent', 2, 14400],
  240: ['earthElementReduction', 2, 10500],
  241: ['waterElementReduction', 2, 10700],
  242: ['airElementReduction', 2, 10800],
  243: ['fireElementReduction', 2, 10600],
  244: ['neutralElementReduction', 2, 10400],
  410: ['apReduction', 7, 12800],
  412: ['mpReduction', 7, 13000],
  414: ['pushDamageBonus', 5, 14000],
  416: ['pushDamageReduction', 2, 14200],
  418: ['criticalDamageBonus', 5, 13600],
  420: ['criticalDamageReduction', 2, 13800],
  422: ['earthDamageBonus', 5, 7700],
  424: ['fireDamageBonus', 5, 7900],
  426: ['waterDamageBonus', 5, 8100],
  428: ['airDamageBonus', 5, 8300],
  430: ['neutralDamageBonus', 5, 7500],
  752: ['tackleEvade', 4, 12500],
  753: ['tackleBlock', 4, 12400],
  2800: ['dealtDamageMultiplierMelee', 15, 14800],
  2803: ['receivedDamageMultiplierMelee', 10, 14810],
  2804: ['dealtDamageMultiplierDistance', 15, 14820],
  2807: ['receivedDamageMultiplierDistance', 10, 14830],
  2808: ['dealtDamageMultiplierWeapon', 15, 14840],
  2812: ['dealtDamageMultiplierSpells', 15, 14860],
};
/** Malus effect id → its bonus effect id. A malus point weighs half the bonus one. */
const MALUS_OF: Readonly<Record<number, number>> = { 116: 117, 152: 123, 153: 125, 154: 119, 155: 126, 156: 124, 157: 118, 162: 160, 163: 161, 168: 111, 169: 128, 171: 115, 175: 174, 177: 176, 179: 178, 186: 138, 215: 210, 216: 211, 217: 212, 218: 213, 219: 214, 246: 241, 411: 410, 413: 412, 415: 414, 417: 416, 419: 418, 421: 420, 423: 422, 425: 424, 427: 426, 429: 428, 431: 430, 754: 752, 755: 753, 2802: 2803, 2805: 2804, 2806: 2807, 2813: 2812, 2990: 182 };

export interface FmRune { id: number; name: string; effectId: number; points: number }
/** Stat runes of the game (item type 78): [item id, short name, effect id, points]. */
export const FM_RUNES: readonly FmRune[] = ([
  [1519, 'Fo', 118, 1],
  [1521, 'Sa', 124, 1],
  [1522, 'Ine', 126, 1],
  [1523, 'Vi', 125, 5],
  [1524, 'Age', 119, 1],
  [1525, 'Cha', 123, 1],
  [1545, 'Pa Fo', 118, 3],
  [1546, 'Pa Sa', 124, 3],
  [1547, 'Pa Ine', 126, 3],
  [1548, 'Pa Vi', 125, 15],
  [1549, 'Pa Age', 119, 3],
  [1550, 'Pa Cha', 123, 3],
  [1551, 'Ra Fo', 118, 10],
  [1552, 'Ra Sa', 124, 10],
  [1553, 'Ra Ine', 126, 10],
  [1554, 'Ra Vi', 125, 50],
  [1555, 'Ra Age', 119, 10],
  [1556, 'Ra Cha', 123, 10],
  [1557, 'Ga Pa', 111, 1],
  [1558, 'Ga Pme', 128, 1],
  [7433, 'Cri', 115, 1],
  [7434, 'So', 178, 1],
  [7435, 'Do', 112, 1],
  [7436, 'Pui', 138, 1],
  [7437, 'Do Ren', 220, 1],
  [7438, 'Po', 117, 1],
  [7442, 'Invo', 182, 1],
  [7443, 'Pod', 158, 10],
  [7444, 'Pa Pod', 158, 30],
  [7445, 'Ra Pod', 158, 100],
  [7446, 'Do Pi', 225, 1],
  [7447, 'Per Pi', 226, 1],
  [7448, 'Ini', 174, 10],
  [7449, 'Pa Ini', 174, 30],
  [7450, 'Ra Ini', 174, 100],
  [7451, 'Prospe', 176, 1],
  [7452, 'Ré Feu', 243, 1],
  [7453, 'Ré Air', 242, 1],
  [7454, 'Ré Eau', 241, 1],
  [7455, 'Ré Terre', 240, 1],
  [7456, 'Ré Neutre', 244, 1],
  [7457, 'Ré Per Feu', 213, 1],
  [7458, 'Ré Per Air', 212, 1],
  [7459, 'Ré Per Terre', 210, 1],
  [7460, 'Ré Per Neutre', 214, 1],
  [7560, 'Ré Per Eau', 211, 1],
  [10613, 'Pa Do Pi', 225, 3],
  [10615, 'Pa Per Pi', 226, 3],
  [10616, 'Ra Per Pi', 226, 10],
  [10618, 'Pa Pui', 138, 3],
  [10619, 'Ra Pui', 138, 10],
  [10662, 'Pa Prospe', 176, 3],
  [11637, 'Fui', 752, 1],
  [11638, 'Pa Fui', 752, 3],
  [11639, 'Tac', 753, 1],
  [11640, 'Pa Tac', 753, 3],
  [11641, 'Ré Pa', 160, 1],
  [11642, 'Pa Ré Pa', 160, 3],
  [11643, 'Ré Pme', 161, 1],
  [11644, 'Pa Ré Pme', 161, 3],
  [11645, 'Ret Pa', 410, 1],
  [11646, 'Pa Ret Pa', 410, 3],
  [11647, 'Ret Pme', 412, 1],
  [11648, 'Pa Ret Pme', 412, 3],
  [11649, 'Do Pou', 414, 1],
  [11650, 'Pa Do Pou', 414, 3],
  [11651, 'Ré Pou', 416, 1],
  [11652, 'Pa Ré Pou', 416, 3],
  [11653, 'Do Cri', 418, 1],
  [11654, 'Pa Do Cri', 418, 3],
  [11655, 'Ré Cri', 420, 1],
  [11656, 'Pa Ré Cri', 420, 3],
  [11657, 'Do Terre', 422, 1],
  [11658, 'Pa Do Terre', 422, 3],
  [11659, 'Do Feu', 424, 1],
  [11660, 'Pa Do Feu', 424, 3],
  [11661, 'Do Eau', 426, 1],
  [11662, 'Pa Do Eau', 426, 3],
  [11663, 'Do Air', 428, 1],
  [11664, 'Pa Do Air', 428, 3],
  [11665, 'Do Neutre', 430, 1],
  [11666, 'Pa Do Neutre', 430, 3],
  [18719, 'Do Per Mé', 2800, 1],
  [18720, 'Do Per Di', 2804, 1],
  [18721, 'Do Per Ar', 2808, 1],
  [18722, 'Do Per So', 2812, 1],
  [18723, 'Ré Per Mé', 2803, 1],
  [18724, 'Ré Per Di', 2807, 1],
  [19337, 'Pa So', 178, 3],
  [19338, 'Pa Ré Air', 242, 3],
  [19339, 'Pa Ré Eau', 241, 3],
  [19340, 'Pa Ré Feu', 243, 3],
  [19341, 'Pa Ré Neutre', 244, 3],
  [19342, 'Pa Ré Terre', 240, 3],
  [29683, 'Ra Ré Pou', 416, 10],
  [29684, 'Ra Do Pou', 414, 10],
  [30695, 'Ra Ré Terre', 240, 10],
  [30696, 'Ra Ré Neutre', 244, 10],
  [30697, 'Ra Ré Feu', 243, 10],
  [30698, 'Ra Ré Eau', 241, 10],
  [30699, 'Ra Ré Cri', 420, 10],
  [30700, 'Ra Ré Air', 242, 10],
  [30942, 'Pa Do Ren', 220, 3],
] as const).map(([id, name, effectId, points]) => ({ id, name, effectId, points }));

export const FM_MODEL = {
  weakClean: 0.66, perfectClean: 0.43, floorClean: 0.15, perfectFailure: 0.07, floorFailure: 0.35,
  /** How far past its perfect jet an item falls to the floor odds. */
  floorPastPerfect: 0.5,
  /**
   * A rune passes well while its line stays under reach × its points (+1 up to ~20, +3 up to ~60, +10 up to ~200: the
   * players' rule, confirmed by small runes failing all the time on big lines); past it the rune's critical and
   * neutral successes fade into critical failures, down to leastClean and leastPartial at reachFade × the reach.
   */
  reach: 20, reachFade: 2, leastClean: 0.01, leastPartial: 0.05,
  overClean: 0.65, exoClean: 0.3, exoApMpRange: 0.01,
  /** Share of critical failures that take nothing away. */
  harmlessFailure: 0.4,
  /** No line weighs more than this through over or exo, unless its perfect jet already does. */
  cap: 101,
  /** Calibration on real outcomes (fmCalibration): multiply the model's critical success and failure chances. */
  cleanScale: 1, failureScale: 1,
};

/** One line of an item for forgemagic, keyed by its bonus effect. Malus lines have negative bounds. */
export interface FmLine { effectId: number; stat: string; weight: number; min: number; max: number; exo?: boolean }
export type FmValues = Record<number, number>;
export interface FmOdds { clean: number; partial: number; failure: number }

const AP_MP_RANGE = [111, 128, 117];

export function fmLines(item: EquipmentItem): FmLine[] {
  const lines: FmLine[] = [];
  for (const effect of item.effects ?? []) {
    if (effect.isInFight) continue;
    const malus = MALUS_OF[effect.effectId];
    const effectId = malus ?? effect.effectId;
    const known = FM_EFFECTS[effectId];
    if (!known || lines.some(line => line.effectId === effectId)) continue;
    const low = effect.diceNum || effect.value, high = Math.max(low, effect.diceSide || low);
    lines.push({ effectId, stat: known[0], weight: known[1], min: malus ? -high : low, max: malus ? -low : high });
  }
  return lines;
}

export const fmExoLine = (effectId: number): FmLine => ({ effectId, stat: FM_EFFECTS[effectId][0], weight: FM_EFFECTS[effectId][1], min: 0, max: 0, exo: true });
const runesByEffect = new Map<number, FmRune[]>();
/** Runes of a line, smallest first. */
export const fmRunesFor = (effectId: number): readonly FmRune[] => {
  let runes = runesByEffect.get(effectId);
  if (!runes) runesByEffect.set(effectId, runes = FM_RUNES.filter(rune => rune.effectId === effectId).sort((a, b) => a.points - b.points));
  return runes;
};
export const fmRuneWeight = (rune: FmRune) => rune.points * FM_EFFECTS[rune.effectId][1];
/** Weight of a value on a line: a malus point weighs half. */
export const fmValueWeight = (line: FmLine, value: number) => value * line.weight * (value < 0 ? 0.5 : 1);
/** Highest value a line can reach: the 101 weight cap, or the perfect jet when heavier. */
export const fmLineCap = (line: FmLine) => Math.max(line.max, Math.floor((FM_MODEL.cap + 1e-9) / line.weight));
export const fmItemWeight = (lines: readonly FmLine[], values: FmValues) =>
  lines.reduce((sum, line) => sum + fmValueWeight(line, values[line.effectId] ?? 0), 0);
export const fmPerfectWeight = (lines: readonly FmLine[]) =>
  lines.reduce((sum, line) => sum + (line.exo ? 0 : fmValueWeight(line, line.max)), 0);

const normalised = (clean: number, failure: number): FmOdds => {
  clean = Math.min(1, Math.max(0, clean));
  failure = Math.min(1 - clean, Math.max(0, failure));
  return { clean, partial: 1 - clean - failure, failure };
};

/** Odds before the rune's own reach: how full the item is compared with its perfect jet. */
function baseOdds(lines: readonly FmLine[], values: FmValues) {
  const M = FM_MODEL, perfect = fmPerfectWeight(lines);
  const fill = perfect > 0 ? fmItemWeight(lines, values) / perfect : 1;
  if (fill <= 1) return { clean: M.weakClean - (M.weakClean - M.perfectClean) * Math.max(0, fill), failure: M.perfectFailure * Math.max(0, fill) };
  const t = Math.min(1, (fill - 1) / M.floorPastPerfect);
  return { clean: M.perfectClean - (M.perfectClean - M.floorClean) * t, failure: M.perfectFailure + (M.floorFailure - M.perfectFailure) * t };
}

/** Estimated odds of a rune on a line: critical success (clean), neutral success (partial), critical failure. */
export function fmOdds(lines: readonly FmLine[], values: FmValues, line: FmLine, rune: FmRune): FmOdds {
  const odds = modelOdds(lines, values, line, rune);
  return odds.failure >= 1 ? odds : normalised(odds.clean * FM_MODEL.cleanScale, odds.failure * FM_MODEL.failureScale);
}

/** The community model, before calibration. */
function modelOdds(lines: readonly FmLine[], values: FmValues, line: FmLine, rune: FmRune): FmOdds {
  const M = FM_MODEL, w = line.weight;
  const current = values[line.effectId] ?? 0, after = current + rune.points;
  const base = baseOdds(lines, values);
  if (line.max <= 0 && current < 0) return normalised(base.clean, base.failure); // eats a malus
  if (line.max <= 0) {
    if (after * w > M.cap + 1e-9) return { clean: 0, partial: 0, failure: 1 };
    if (AP_MP_RANGE.includes(line.effectId)) {
      const otherExo = lines.some(other => other !== line && other.max <= 0 && AP_MP_RANGE.includes(other.effectId) && (values[other.effectId] ?? 0) > 0);
      return otherExo || current > 0 ? { clean: 0, partial: 0, failure: 1 } : { clean: M.exoApMpRange, partial: 0, failure: 1 - M.exoApMpRange };
    }
    const clean = base.clean * M.exoClean * (1 - after * w / M.cap);
    const partial = (1 - base.clean - base.failure) * M.exoClean;
    return normalised(clean, 1 - clean - partial);
  }
  let { clean, failure } = base;
  const x = current / (M.reach * rune.points);
  if (x > 1) {
    // Past its reach a rune stops passing at all: its neutral success fades with its critical one, into failures.
    const fade = Math.min(1, Math.max(0, 1 - (x - 1) / (M.reachFade - 1)));
    const partial = 1 - clean - failure;
    const kept = Math.min(clean, Math.max(M.leastClean, clean * fade));
    const keptPartial = Math.min(partial, Math.max(M.leastPartial, partial * fade));
    failure += clean - kept + partial - keptPartial; clean = kept;
  }
  if (after > line.max) {
    const maxWeight = line.max * w, cap = Math.max(M.cap, maxWeight);
    if (after * w > cap + 1e-9) return { clean: 0, partial: 0, failure: 1 };
    const share = (after * w - maxWeight) / Math.max(cap - maxWeight, 1e-9);
    const kept = clean * M.overClean * (1 - share);
    failure += (clean - kept) * 2 / 3; clean = kept;
  }
  return normalised(clean, failure);
}

export interface FmAdvice { line: FmLine; rune: FmRune; odds: FmOdds }
/**
 * Points a rune may add to a line: targets are minimums and the aim is the biggest roll, so up to the perfect jet
 * (87/100 aiming at 90 takes a +10); past it only for an over the target asks for.
 */
const roomOf = (line: FmLine, values: FmValues, targets: FmValues) =>
  Math.max(targets[line.effectId] ?? 0, line.max) - (values[line.effectId] ?? 0);
/** Runes allowed on a line: those within its room, or else its smallest one, to finish it. */
const runesWithin = (line: FmLine, values: FmValues, targets: FmValues) => {
  const room = roomOf(line, values, targets), runes = fmRunesFor(line.effectId);
  return runes.filter((rune, i) => i === 0 || rune.points <= room);
};
/**
 * How the rest of a session is played. Line order: heavy, heaviest lines first; pool, light lines first so the
 * losses they cause build a pool, then a heavy rune once the pool covers it. Rune size: by default the rune with
 * the best critical-success gain (points × chance) that does not overshoot; -small, always the smallest rune.
 */
export type FmPolicy = 'heavy' | 'pool' | 'heavy-small' | 'pool-small';
export const FM_POLICIES: readonly FmPolicy[] = ['heavy', 'pool', 'heavy-small', 'pool-small'];

/** Next rune of a policy: in-range lines before overs, never past the perfect jet (or an asked over) but with the smallest rune. */
export function fmAdvice(lines: readonly FmLine[], values: FmValues, targets: FmValues, policy: FmPolicy = 'heavy', pool = 0): FmAdvice | undefined {
  const byPool = policy.startsWith('pool');
  let line: FmLine | undefined, rank = Infinity;
  for (const candidate of lines) {
    if ((targets[candidate.effectId] ?? 0) <= (values[candidate.effectId] ?? 0)) continue;
    const runes = fmRunesFor(candidate.effectId);
    if (!runes.length) continue;
    // A heavy line waits for the pool to cover its smallest rune, unless nothing else is left; overs come last.
    const waits = byPool && fmRuneWeight(runes[0]) > Math.max(pool, 9) ? 1 : 0;
    const over = (targets[candidate.effectId] ?? 0) > candidate.max ? 1 : 0;
    const order = waits * 4000 + over * 2000 + (byPool ? candidate.weight : 1000 - candidate.weight);
    if (order < rank) { rank = order; line = candidate; }
  }
  if (!line) return undefined;
  const runes = runesWithin(line, values, targets);
  let rune = runes[0], odds = fmOdds(lines, values, line, rune);
  if (!policy.endsWith('small')) for (const other of runes) {
    if (other === runes[0]) continue;
    const otherOdds = fmOdds(lines, values, line, other);
    if (otherOdds.clean * other.points >= odds.clean * rune.points) { rune = other; odds = otherOdds; }
  }
  return { line, rune, odds };
}

/**
 * Lines whose target can only be reached with a rune that has almost no chance of passing: the room left is
 * smaller than every rune that still passes on the line (the last point of a big line, typically).
 */
export function fmHardLines(lines: readonly FmLine[], values: FmValues, targets: FmValues, threshold = 0.05): { line: FmLine; rune: FmRune; odds: FmOdds }[] {
  const hard = [];
  for (const line of lines) {
    if ((targets[line.effectId] ?? 0) <= (values[line.effectId] ?? 0)) continue;
    const runes = runesWithin(line, values, targets);
    if (!runes.length) continue;
    const options = runes.map(rune => ({ line, rune, odds: fmOdds(lines, values, line, rune) }));
    const best = options.reduce((a, b) => (b.odds.clean > a.odds.clean ? b : a));
    if (best.odds.clean < threshold) hard.push(best);
  }
  return hard;
}

// ─── Simulating a rune and planning the session ──────────────────────────────────────────

export type FmOutcome = 'clean' | 'partial' | 'failure';
export interface FmState { values: FmValues; pool: number }
/** Seedable random numbers (mulberry32): rollouts of every candidate share the same draws. */
export function fmRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const fmRollOutcome = (odds: FmOdds, random: () => number): FmOutcome => {
  const roll = random();
  return roll < odds.clean ? 'clean' : roll < odds.clean + odds.partial ? 'partial' : 'failure';
};

/**
 * What an outcome does: the rune's points go in unless it failed; a neutral success, and most critical failures,
 * cost the rune's weight, out of the pool first, then whole points of a random line (over-maximum ones first,
 * the rune's own last on a neutral success). What a whole point takes beyond the weight goes to the pool.
 */
export function fmApply(lines: readonly FmLine[], state: FmState, line: FmLine, rune: FmRune, outcome: FmOutcome, random: () => number): FmState {
  const values = { ...state.values };
  let pool = state.pool;
  if (outcome !== 'failure') values[line.effectId] = (values[line.effectId] ?? 0) + rune.points;
  if (outcome === 'clean' || (outcome === 'failure' && random() < FM_MODEL.harmlessFailure)) return { values, pool };
  const weight = fmRuneWeight(rune);
  if (pool >= weight - 1e-9) return { values, pool: pool - weight };
  let need = weight - pool;
  pool = 0;
  const spare = outcome === 'partial';
  while (need > 1e-9) {
    let candidates = lines.filter(other => (values[other.effectId] ?? 0) > 0 && (other !== line || !spare));
    if (!candidates.length && spare && (values[line.effectId] ?? 0) > 0) candidates = [line];
    if (!candidates.length) break;
    const overs = candidates.filter(other => (values[other.effectId] ?? 0) > other.max);
    const from = overs.length ? overs : candidates;
    const lost = from[Math.floor(random() * from.length)];
    const points = Math.min(values[lost.effectId], Math.max(1, Math.ceil(need / lost.weight - 1e-9)));
    values[lost.effectId] -= points;
    need -= points * lost.weight;
  }
  if (need < 0) pool -= need;
  return { values, pool: Math.round(pool * 100) / 100 };
}

const reached = (lines: readonly FmLine[], values: FmValues, targets: FmValues) =>
  lines.every(line => (values[line.effectId] ?? 0) >= (targets[line.effectId] ?? 0));

export interface FmPlanOption extends FmAdvice {
  /** Share of simulated sessions that reach every target within the budget, with the best policy after this rune. */
  success: number;
  /** Mean runes passed by the successful sessions, this one included. */
  runes: number;
  policy: FmPolicy;
  /** Simulated sessions behind the estimate: the best options get the most. */
  rollouts: number;
  /** Standard error of `runes`. */
  runesError: number;
}
export interface FmPlanOptions { rollouts?: number; maxRollouts?: number; budget?: number; seed?: number }

type Arm = FmPlanOption & { wins: number; used: number; usedSquares: number };
const better = (a: FmPlanOption, b: FmPlanOption) => a.success - b.success || b.runes - a.runes;
/**
 * Final ranking: options whose chances simulation noise cannot tell apart (two standard errors) count as equal,
 * then so do their runes; equal options go by the rune's own critical-success chance, so a near-hopeless small
 * rune is never advised over an equivalent one that passes.
 */
function rank(a: FmPlanOption, b: FmPlanOption) {
  const noise = 2 * Math.sqrt(a.success * (1 - a.success) / a.rollouts + b.success * (1 - b.success) / b.rollouts) + 0.005;
  if (Math.abs(a.success - b.success) > noise) return b.success - a.success;
  if (Number.isFinite(a.runes) && Number.isFinite(b.runes) && Math.abs(a.runes - b.runes) > 2 * Math.hypot(a.runesError, b.runesError)) return a.runes - b.runes;
  return b.odds.clean - a.odds.clean || a.runes - b.runes;
}

/**
 * Rollout planner. Every rune that can raise a missing line is tried first, then the session is played to the end
 * by each policy (parallel rollout: a rune is worth its best policy). Successive halving spends the simulations
 * where they matter: all (rune, policy) pairs start with `rollouts` sessions, the better half doubles, and so on up
 * to `maxRollouts`. Every arm replays the same random draws (common random numbers), so the ranking is not noise.
 * Options are ranked by the chance of reaching the targets within `budget` runes, then by the runes it takes (rank).
 */
export function fmPlan(lines: readonly FmLine[], start: FmState, targets: FmValues, { rollouts = 16, maxRollouts = 256, budget = 150, seed = 1 }: FmPlanOptions = {}): FmPlanOption[] {
  const arms: Arm[] = [];
  for (const line of lines) {
    if ((targets[line.effectId] ?? 0) <= (start.values[line.effectId] ?? 0)) continue;
    // An unasked over wastes pool and weight: past the perfect jet, only the smallest rune, to finish the line.
    for (const rune of runesWithin(line, start.values, targets)) {
      const odds = fmOdds(lines, start.values, line, rune);
      if (odds.failure >= 1) continue;
      for (const policy of FM_POLICIES) arms.push({ line, rune, odds, policy, success: 0, runes: Infinity, runesError: Infinity, rollouts: 0, wins: 0, used: 0, usedSquares: 0 });
    }
  }
  const play = (arm: Arm, until: number) => {
    for (let i = arm.rollouts; i < until; i++) {
      const random = fmRandom(seed * 7919 + i);
      let state = fmApply(lines, start, arm.line, arm.rune, fmRollOutcome(arm.odds, random), random);
      let clicks = 1;
      while (clicks < budget && !reached(lines, state.values, targets)) {
        const next = fmAdvice(lines, state.values, targets, arm.policy, state.pool);
        if (!next) break;
        state = fmApply(lines, state, next.line, next.rune, fmRollOutcome(next.odds, random), random);
        clicks++;
      }
      if (reached(lines, state.values, targets)) { arm.wins++; arm.used += clicks; arm.usedSquares += clicks * clicks; }
    }
    arm.rollouts = until;
    arm.success = arm.wins / until;
    arm.runes = arm.wins ? arm.used / arm.wins : Infinity;
    arm.runesError = arm.wins > 1 ? Math.sqrt(Math.max(0, arm.usedSquares / arm.wins - arm.runes ** 2) / arm.wins) : Infinity;
  };
  let alive = arms, n = rollouts;
  for (;;) {
    for (const arm of alive) play(arm, n);
    if (alive.length <= 2 || n >= maxRollouts) break;
    alive = [...alive].sort((a, b) => better(b, a)).slice(0, Math.ceil(alive.length / 2));
    n = Math.min(maxRollouts, n * 2);
  }
  // One option per rune: its best policy, preferring the estimate backed by the most sessions.
  const best = new Map<FmRune, Arm>();
  for (const arm of arms) {
    const seen = best.get(arm.rune);
    if (!seen || arm.rollouts > seen.rollouts || (arm.rollouts === seen.rollouts && better(arm, seen) > 0)) best.set(arm.rune, arm);
  }
  return [...best.values()].sort(rank).map(({ wins: _wins, used: _used, usedSquares: _squares, ...option }) => option);
}

// ─── Learning from real outcomes ─────────────────────────────────────────────────────────

/** A rune passed in game: the odds the model gave it, what happened, and whether the screen or a click told us. */
export interface FmObservation extends FmOdds { outcome: FmOutcome; seen: 'screen' | 'manual' }

/**
 * What a rune did, from the item before and after it, as the game window shows it: one line up by a rune's points
 * is a success, clean if nothing else moved; nothing up but a loss is a critical failure (its rune is unknown).
 * A harmless failure changes nothing and cannot be seen. Several lines up at once is an OCR misread: undefined.
 */
export function fmDetectOutcome(lines: readonly FmLine[], before: FmState, after: FmState): { line?: FmLine; rune?: FmRune; outcome: FmOutcome } | undefined {
  const delta = (line: FmLine) => (after.values[line.effectId] ?? 0) - (before.values[line.effectId] ?? 0);
  const up = lines.filter(line => delta(line) > 0);
  const lost = lines.some(line => delta(line) < 0) || after.pool !== before.pool;
  if (up.length > 1) return undefined;
  if (!up.length) return lost ? { outcome: 'failure' } : undefined;
  const rune = fmRunesFor(up[0].effectId).find(rune => rune.points === delta(up[0]));
  return rune && { line: up[0], rune, outcome: lost ? 'partial' : 'clean' };
}

export interface FmCalibration { cleanScale: number; failureScale: number; count: number; observed: FmOdds; predicted: FmOdds }

/**
 * Maximum-likelihood scales of the model's critical success and failure chances, from real outcomes, with a prior
 * that keeps them at 1 until enough runes are seen. Screen observations miss harmless failures, so their likelihood
 * is taken given that something changed.
 */
export function fmCalibration(log: readonly FmObservation[]): FmCalibration {
  const prior = 6, harmless = FM_MODEL.harmlessFailure;
  const steps = Array.from({ length: 41 }, (_, i) => Math.exp((i - 20) * 0.06));
  let best = { cleanScale: 1, failureScale: 1, score: -Infinity };
  for (const cleanScale of steps) for (const failureScale of steps) {
    let score = -prior * (Math.log(cleanScale) ** 2 + Math.log(failureScale) ** 2);
    for (const entry of log) {
      const odds = entry.failure >= 1 ? entry : normalised(entry.clean * cleanScale, entry.failure * failureScale);
      const visible = entry.seen === 'screen' ? 1 - odds.failure * harmless : 1;
      const p = entry.outcome === 'clean' ? odds.clean : entry.outcome === 'partial' ? odds.partial
        : odds.failure * (entry.seen === 'screen' ? 1 - harmless : 1);
      score += Math.log(Math.max(1e-6, p / Math.max(1e-6, visible)));
    }
    if (score > best.score) best = { cleanScale, failureScale, score };
  }
  const share = (outcome: FmOutcome) => log.length ? log.filter(entry => entry.outcome === outcome).length / log.length : 0;
  const mean = (key: keyof FmOdds) => log.length ? log.reduce((sum, entry) => sum + entry[key], 0) / log.length : 0;
  return {
    cleanScale: best.cleanScale, failureScale: best.failureScale, count: log.length,
    observed: { clean: share('clean'), partial: share('partial'), failure: share('failure') },
    predicted: { clean: mean('clean'), partial: mean('partial'), failure: mean('failure') },
  };
}

// ─── Reading the game's forgemagic window (OCR text) ─────────────────────────────────────

const words = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z%]+/g, ' ').trim().split(' ').filter(Boolean).map(word => word.replace(/s$/, ''));
const labelKey = (text: string) => words(text).join(' ');

/** Normalised effect label ("% critique", "dommage feu") → bonus effect id, from the catalog's effect texts. */
export function fmEffectLabels(catalog: Pick<Catalog, 'items'>): Map<string, number> {
  const labels = new Map<string, number>();
  for (const item of catalog.items) for (const effect of item.effects ?? []) {
    const effectId = MALUS_OF[effect.effectId] ?? effect.effectId;
    if (!FM_EFFECTS[effectId] || !effect.description) continue;
    const key = labelKey(effect.description.replace(/\{\{[^}]*\}\}/g, '').replace(/#\d/g, ''));
    if (key && !labels.has(key)) labels.set(key, effectId);
  }
  return labels;
}

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

export interface FmScreenRead { values: FmValues; pool?: number; exact: Set<number> }

/**
 * Effect values read from OCR text of the game's forgemagic table ("201 250 ♥ 225 Vitalité 241 87 57"): the value is
 * the number right before an effect label, so the Min/Max columns and rune counts around it are skipped.
 * "Reliquat : 4,4" gives the pool. OCR typos on long labels are matched loosely.
 */
export function fmParseScreen(text: string, labels: Map<string, number>): FmScreenRead {
  const read: FmScreenRead = { values: {}, exact: new Set() };
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    const pool = line.match(/(?:reliquat|puits)[^\dOo]*(\d+(?:[.,]\d+)?|[Oo]\b)/i);
    if (pool) { read.pool = Number(pool[1].replace(/[Oo]/, '0').replace(',', '.')); continue; }
    for (const match of line.matchAll(/(?:^|\s)([+\-−]?)(\d+)\s*(%?)\s+([^\d+\-−]+?)(?=\s+[+\-−]?\d|$)/g)) {
      // OCR debris may trail the label ("Dommages Eau cd"): try its word prefixes, longest first.
      const all = words(`${match[3]} ${match[4]}`);
      const keys = all.map((_, i) => all.slice(0, all.length - i).join(' ')).filter(key => key.replace(/[ %]/g, '').length >= 2);
      let effectId: number | undefined, exact = false, best = Infinity;
      for (const key of keys) if ((effectId = labels.get(key)) !== undefined) { exact = true; break; }
      if (!exact) for (const key of keys.filter(key => key.length >= 4)) {
        for (const [label, id] of labels) {
          const d = distance(key, label);
          if (d <= Math.floor(key.length / 6) + 1 && d < best) { best = d; effectId = id; }
        }
      }
      if (effectId === undefined || effectId in read.values) continue;
      read.values[effectId] = (match[1] && match[1] !== '+' ? -1 : 1) * Number(match[2]);
      if (exact) read.exact.add(effectId);
    }
  }
  return read;
}
