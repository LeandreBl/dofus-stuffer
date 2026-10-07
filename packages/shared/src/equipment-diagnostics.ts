import { evaluateBuild, SLOTS, slotType, STAT_CAPS } from './index.js';
import type { BuildEvaluation, Catalog, EquipmentItem, ExoStat, ItemCondition, OptimizationRequest, Slot, Stats } from './types.js';

export interface ConditionDiagnostic {
  kind: ItemCondition['kind'];
  label: string;
  text: string;
  satisfied: boolean | null;
  stat?: string;
  operator?: ItemCondition['operator'];
  value?: number;
  actual?: number;
  children?: ConditionDiagnostic[];
}
export interface EquipmentIssue {
  code: string;
  message: string;
  slots: Slot[];
  severity: 'error' | 'unknown';
}
export interface EquipmentItemDiagnostic {
  slot: Slot;
  itemId: number;
  invalid: boolean;
  issues: EquipmentIssue[];
  condition?: ConditionDiagnostic;
}
export interface EquipmentLimit {
  raw: number;
  effective: number;
  cap: number;
  /** Necessary upper bound, with the other characteristics of this build held fixed. */
  equipmentMaximum: number | null;
  strictMaximum: number | null;
  sources: { slot: Slot; itemId: number; name: string; text: string; maximum: number }[];
}
export interface ExoPreview {
  status: 'active' | 'possible' | 'blocked' | 'noGain';
  before: number;
  after: number;
  reasons: string[];
  affectedSlots: Slot[];
}
export interface EquipmentDiagnostics {
  items: Partial<Record<Slot, EquipmentItemDiagnostic>>;
  issues: EquipmentIssue[];
  limits: Record<ExoStat, EquipmentLimit>;
  exos: Record<ExoStat, ExoPreview>;
}

const statLabels: Record<string, string> = {
  strength: 'Force', intelligence: 'Intelligence', chance: 'Chance', agility: 'Agilité', vitality: 'Vitalité', wisdom: 'Sagesse',
  actionPoints: 'PA', movementPoints: 'PM', range: 'PO', level: 'Niveau', classId: 'Classe',
  activeSetCount: 'Panoplies actives', setBonusCount: 'Bonus de panoplie', setBonus: 'Bonus de panoplie', maxSetPieces: 'Objets dans une même panoplie',
};
const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;
const statLabel = (catalog: Catalog, stat?: string) => statLabels[stat ?? ''] ?? catalog.stats.find(entry => entry.key === stat)?.name ?? stat ?? 'Condition';
const integerPrerequisites = new Set(Object.keys(statLabels).filter(key => key !== 'classId'));
const conditionNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10 });
const unverifiedCondition = 'Condition particulière à vérifier en jeu';
const readableDescription = (description?: string) => description && !/\b[A-Za-z]{2}(?:[<>=!~])/.test(description)
  ? description : unverifiedCondition;

/** The same expression is used in catalogue cards and evaluated equipment details. */
export function formatItemCondition(condition: ItemCondition, catalog: Catalog): string {
  if (condition.kind === 'and' || condition.kind === 'or') {
    if (!condition.children?.length) return readableDescription(condition.description);
    const joiner = condition.kind === 'and' ? ' ET ' : ' OU ';
    return condition.children.map(child => {
      const text = formatItemCondition(child, catalog);
      return child.kind === 'and' || child.kind === 'or' ? `(${text})` : text;
    }).join(joiner);
  }
  if (condition.kind === 'stat' && condition.stat && condition.operator && Number.isFinite(condition.value)) {
    const label = statLabel(catalog, condition.stat);
    if (condition.stat === 'classId') {
      const name = catalog.classes.find(entry => entry.id === condition.value)?.name;
      if (!name || !['=', '!='].includes(condition.operator)) return 'Classe requise à vérifier en jeu';
      return condition.operator === '=' ? `Classe : ${name}` : `Classe : autre que ${name}`;
    }
    let value = condition.value!;
    let operator = condition.operator;
    // Natural characteristics, PA/PM and panoply counts are integers. Display
    // their actual inclusive threshold without changing the evaluation rule.
    if (integerPrerequisites.has(condition.stat)) {
      if (operator === '>') { value = Math.floor(value) + 1; operator = '>='; }
      if (operator === '<') { value = Math.ceil(value) - 1; operator = '<='; }
    }
    const qualifier = { '>': 'plus de', '<': 'moins de', '>=': 'au moins', '<=': 'au plus', '=': 'exactement', '!=': 'différent de' }[operator];
    return `${label} : ${qualifier} ${conditionNumber.format(value)}`;
  }
  return readableDescription(condition.description);
}

function compare(actual: number, operator: ItemCondition['operator'], value: number): boolean | null {
  if (operator === '>') return actual > value;
  if (operator === '<') return actual < value;
  if (operator === '>=') return actual >= value;
  if (operator === '<=') return actual <= value;
  if (operator === '=') return actual === value;
  if (operator === '!=') return actual !== value;
  return null;
}

function inspectCondition(condition: ItemCondition, catalog: Catalog, stats: Stats): ConditionDiagnostic {
  const diagnostic: ConditionDiagnostic = {
    kind: condition.kind, label: statLabel(catalog, condition.stat), text: formatItemCondition(condition, catalog), satisfied: null,
  };
  if (condition.kind === 'and' || condition.kind === 'or') {
    diagnostic.label = condition.kind === 'and' ? 'Toutes les conditions' : 'Au moins une condition';
    diagnostic.children = condition.children?.map(child => inspectCondition(child, catalog, stats));
    if (!diagnostic.children?.length) return diagnostic;
    const states = diagnostic.children.map(child => child.satisfied);
    diagnostic.satisfied = condition.kind === 'and'
      ? states.includes(false) ? false : states.includes(null) ? null : true
      : states.includes(true) ? true : states.includes(null) ? null : false;
    return diagnostic;
  }
  if (condition.kind === 'stat' && condition.stat && Number.isFinite(condition.value)) {
    diagnostic.stat = condition.stat;
    diagnostic.operator = condition.operator;
    diagnostic.value = condition.value;
    diagnostic.actual = finite(stats[condition.stat]);
    diagnostic.satisfied = compare(diagnostic.actual, condition.operator, condition.value!);
  }
  return diagnostic;
}

/** Effective stats have already been capped; prerequisites deliberately use raw equipped totals. */
function prerequisiteStats(evaluation: BuildEvaluation): Stats {
  const stats = { ...evaluation.stats };
  for (const key of Object.keys(STAT_CAPS)) {
    const part = evaluation.breakdown[key];
    if (part) stats[key] = part.base + part.scroll + part.equipment;
  }
  return stats;
}

type Equipped = { slot: Slot; item: EquipmentItem };
function failedLeaves(condition: ConditionDiagnostic): ConditionDiagnostic[] {
  // An undecided OR may still be satisfied by its unknown branch. Its false
  // alternatives are not established conflicts, even inside a failing AND.
  if (condition.satisfied !== false) return [];
  return condition.children?.flatMap(failedLeaves) ?? [condition];
}
function conditionContributors(condition: ConditionDiagnostic, equipped: Equipped[], evaluation: BuildEvaluation): Slot[] {
  const contributors = new Set<Slot>();
  for (const leaf of failedLeaves(condition)) {
    if (leaf.satisfied !== false || !leaf.stat) continue;
    const upper = leaf.operator === '<' || leaf.operator === '<=';
    const lower = leaf.operator === '>' || leaf.operator === '>=';
    const direction = upper ? 1 : lower ? -1 : Math.sign((leaf.actual ?? 0) - (leaf.value ?? 0));
    if (['activeSetCount', 'setBonusCount', 'setBonus', 'maxSetPieces'].includes(leaf.stat)) {
      if (!upper && direction <= 0) continue;
      const counts = new Map<number, number>();
      for (const entry of equipped) if (entry.item.setId) counts.set(entry.item.setId, (counts.get(entry.item.setId) ?? 0) + 1);
      for (const entry of equipped) {
        const count = counts.get(entry.item.setId ?? 0) ?? 0;
        if (count >= 2 && (leaf.stat !== 'maxSetPieces' || count === finite(evaluation.stats.maxSetPieces))) contributors.add(entry.slot);
      }
      continue;
    }
    for (const entry of equipped) {
      if (finite(entry.item.stats[leaf.stat]) * direction > 0) contributors.add(entry.slot);
      const bonus = evaluation.sets.find(set => set.id === entry.item.setId);
      if (bonus && finite(bonus.stats[leaf.stat]) * direction > 0) contributors.add(entry.slot);
    }
  }
  return [...contributors];
}

function equipmentState(catalog: Catalog, request: OptimizationRequest, evaluation: BuildEvaluation) {
  const items: EquipmentDiagnostics['items'] = {};
  const issues: EquipmentIssue[] = [];
  const equipped: Equipped[] = [];
  const itemMap = new Map(catalog.items.map(item => [item.id, item]));
  const stats = prerequisiteStats(evaluation);
  const addIssue = (code: string, message: string, slots: Slot[], severity: EquipmentIssue['severity'] = 'error') => {
    issues.push({ code, message, slots: [...new Set(slots)], severity });
  };
  for (const slot of SLOTS) {
    const id = evaluation.build.slots[slot];
    if (!id) continue;
    items[slot] = { slot, itemId: id, invalid: false, issues: [] };
    const item = itemMap.get(id);
    if (!item) { addIssue('unknown-item', 'Objet inconnu du catalogue.', [slot], 'unknown'); continue; }
    equipped.push({ slot, item });
    if (item.slotType !== slotType(slot)) addIssue('wrong-slot', `${item.name} ne correspond pas à cet emplacement.`, [slot]);
    if (item.level > request.character.level) addIssue('level', `${item.name} demande le niveau ${item.level} (niveau actuel : ${request.character.level}).`, [slot]);
    if (request.filters.excludedItemIds.includes(id) || request.filters.excludedTypeIds.includes(item.typeId) || request.filters.excludedCategories.includes(item.category)) addIssue('excluded', `${item.name} fait partie des exclusions de cette recherche.`, [slot]);
    if (request.filters.allowedItemIds && !request.filters.allowedItemIds.includes(id)) addIssue('not-allowed', `${item.name} ne fait pas partie des objets autorisés dans cette recherche.`, [slot]);
    if (item.dataWarnings?.length) addIssue('item-data', `${item.name} : ${item.dataWarnings.join(' ')}`, [slot], 'unknown');
  }
  const duplicates = new Map<number, Equipped[]>();
  for (const entry of equipped) duplicates.set(entry.item.id, [...(duplicates.get(entry.item.id) ?? []), entry]);
  for (const entries of duplicates.values()) {
    const item = entries[0].item;
    if (entries.length > 1 && !(item.slotType === 'ring' && !item.setId)) addIssue('duplicate', `${item.name} ne peut pas être équipé plusieurs fois.`, entries.map(entry => entry.slot));
  }
  const prysmaradites = equipped.filter(entry => entry.item.typeId === 217);
  if (prysmaradites.length > 1) addIssue('prysmaradite', 'Une seule prysmaradite peut être équipée.', prysmaradites.map(entry => entry.slot));
  for (const { slot, item } of equipped) {
    if (!item.conditions) continue;
    const condition = inspectCondition(item.conditions, catalog, stats);
    items[slot]!.condition = condition;
    if (condition.satisfied === false) {
      const details = condition.actual !== undefined ? `actuel : ${condition.actual}`
        : failedLeaves(condition).filter(leaf => leaf.satisfied === false && leaf.actual !== undefined)
          .map(leaf => `${leaf.text} ; actuel : ${leaf.actual}`).join(' • ');
      addIssue('condition', `${item.name} : ${condition.text}${details ? ` (${details})` : ''}.`, [slot, ...conditionContributors(condition, equipped, evaluation)]);
    } else if (condition.satisfied === null) addIssue('unknown-condition', `${item.name} : condition à vérifier — ${condition.text}.`, [slot], 'unknown');
  }
  for (const issue of issues) for (const slot of issue.slots) {
    const item = items[slot];
    if (item) { item.issues.push(issue); if (issue.severity === 'error') item.invalid = true; }
  }
  return { items, issues, equipped, stats };
}

// Exact integer intervals preserve OR branches and disjoint valid ranges. Other
// characteristics are held fixed; an unknown branch never invents an upper bound.
type Interval = [number, number];
function intersect(left: Interval[], right: Interval[]): Interval[] {
  return left.flatMap(a => right.map(b => [Math.max(a[0], b[0]), Math.min(a[1], b[1])] as Interval).filter(range => range[0] <= range[1]));
}
function allowedIntegers(condition: ItemCondition, stat: ExoStat, stats: Stats): Interval[] | null {
  if (condition.kind === 'and' || condition.kind === 'or') {
    if (!condition.children?.length) return null;
    const children = condition.children.map(child => allowedIntegers(child, stat, stats));
    if (children.some(child => child === null)) return null;
    return condition.kind === 'and'
      ? (children as Interval[][]).reduce(intersect, [[0, Infinity]])
      : (children as Interval[][]).flat();
  }
  if (condition.kind !== 'stat' || !condition.stat || !Number.isFinite(condition.value)) return null;
  if (condition.stat !== stat) {
    const result = compare(finite(stats[condition.stat]), condition.operator, condition.value!);
    return result === null ? null : result ? [[0, Infinity]] : [];
  }
  const value = condition.value!;
  if (condition.operator === '<') return intersect([[0, Math.ceil(value) - 1]], [[0, Infinity]]);
  if (condition.operator === '<=') return intersect([[0, Math.floor(value)]], [[0, Infinity]]);
  if (condition.operator === '>') return [[Math.max(0, Math.floor(value) + 1), Infinity]];
  if (condition.operator === '>=') return [[Math.max(0, Math.ceil(value)), Infinity]];
  if (condition.operator === '=') return Number.isInteger(value) && value >= 0 ? [[value, value]] : [];
  if (condition.operator === '!=') return Number.isInteger(value) && value >= 0 ? [...(value > 0 ? [[0, value - 1] as Interval] : []), [value + 1, Infinity]] : [[0, Infinity]];
  return null;
}

function conditionalMaximum(condition: ItemCondition, stat: ExoStat, stats: Stats): number | null {
  if (condition.kind === 'and') {
    // A mandatory PA/PM ceiling survives another missing prerequisite (or an
    // unmodelled one). OR still requires analysis of the entire expression.
    const maxima = (condition.children ?? []).map(child => conditionalMaximum(child, stat, stats)).filter((value): value is number => value !== null);
    return maxima.length ? Math.min(...maxima) : null;
  }
  const intervals = allowedIntegers(condition, stat, stats);
  if (!intervals?.length) return null;
  const maximum = Math.max(...intervals.map(range => range[1]));
  return Number.isFinite(maximum) ? maximum : null;
}

/** On-demand UI diagnostics. This is intentionally not part of the optimizer's hot path. */
export function inspectEquipment(catalog: Catalog, request: OptimizationRequest, evaluation: BuildEvaluation): EquipmentDiagnostics {
  const current = equipmentState(catalog, request, evaluation);
  const limits = {} as EquipmentDiagnostics['limits'];
  const exos = {} as EquipmentDiagnostics['exos'];
  for (const stat of ['actionPoints', 'movementPoints'] as const) {
    const label = statLabels[stat];
    const sources: EquipmentLimit['sources'] = [];
    for (const { slot, item } of current.equipped) {
      if (!item.conditions) continue;
      const maximum = conditionalMaximum(item.conditions, stat, current.stats);
      if (maximum !== null) sources.push({ slot, itemId: item.id, name: item.name, text: formatItemCondition(item.conditions, catalog), maximum });
    }
    const strictBounds = request.constraints.filter(constraint => constraint.kind === 'stat' && constraint.statKey === stat && constraint.strict && constraint.relation === 'atMost').map(constraint => constraint.target);
    limits[stat] = {
      raw: finite(current.stats[stat]), effective: finite(evaluation.stats[stat]), cap: STAT_CAPS[stat],
      equipmentMaximum: sources.length ? Math.min(...sources.map(source => source.maximum)) : null,
      strictMaximum: strictBounds.length ? Math.min(...strictBounds) : null, sources,
    };
    const before = finite(evaluation.stats[stat]);
    if (evaluation.build.exoBonuses?.includes(stat)) {
      const without = evaluateBuild(catalog, { ...request, constraints: [] }, {
        ...evaluation.build, exoBonuses: evaluation.build.exoBonuses.filter(exo => exo !== stat),
      });
      const reasons = [`Exo ${label} déjà actif ; tu peux le retirer.`];
      if (finite(without.stats[stat]) >= before) reasons.push(`Sans cet exo, le plafond de ${STAT_CAPS[stat]} ${label} est déjà atteint : il n’ajoute aucun ${label} utilisable.`);
      reasons.push(...current.issues.map(issue => issue.message));
      for (const constraint of request.constraints) {
        if (constraint.kind === 'stat' && constraint.statKey === stat && constraint.strict && constraint.relation === 'atMost' && before > constraint.target) {
          reasons.push(`La contrainte globale impose ${label} ≤ ${constraint.target} ; avec cet exo : ${before}.`);
        }
      }
      exos[stat] = { status: 'active', before, after: before, reasons: [...new Set(reasons)], affectedSlots: [...new Set(current.issues.flatMap(issue => issue.slots))] };
      continue;
    }
    const reasons: string[] = [];
    if (!request.filters.allowedExos?.includes(stat)) reasons.push(`L’exo ${label} n’est pas autorisé dans cette recherche.`);
    const maxExos = request.filters.maxExos ?? 2;
    if ((evaluation.build.exoBonuses?.length ?? 0) >= maxExos) reasons.push(`Le maximum autorisé de ${maxExos} exo${maxExos > 1 ? 's' : ''} est atteint.`);
    // Keep the exact allocation of the displayed build; do not silently reallocate
    // points while checking whether a single exotic bonus can be added to it.
    const next = evaluateBuild(catalog, { ...request, constraints: [] }, {
      ...evaluation.build, exoBonuses: [...(evaluation.build.exoBonuses ?? []), stat],
    });
    const after = finite(next.stats[stat]);
    const state = equipmentState(catalog, request, next);
    const affectedSlots = [...new Set(state.issues.flatMap(issue => issue.slots))];
    reasons.push(...state.issues.map(issue => `Avec cet exo : ${issue.message}`));
    for (const constraint of request.constraints) {
      if (constraint.kind !== 'stat' || !constraint.strict || constraint.relation !== 'atMost' || !['actionPoints', 'movementPoints'].includes(constraint.statKey ?? '')) continue;
      const actual = finite(next.stats[constraint.statKey!]);
      if (actual > constraint.target) reasons.push(`La contrainte globale impose ${statLabel(catalog, constraint.statKey)} ≤ ${constraint.target} ; avec cet exo : ${actual}.`);
    }
    const blocked = reasons.length > 0;
    if (after <= before) reasons.push(`Le plafond de ${STAT_CAPS[stat]} ${label} est déjà atteint : cet exo n’ajoute aucun ${label} utilisable.`);
    exos[stat] = { status: blocked ? 'blocked' : after <= before ? 'noGain' : 'possible', before, after, reasons: [...new Set(reasons)], affectedSlots };
  }
  return { items: current.items, issues: current.issues, limits, exos };
}
