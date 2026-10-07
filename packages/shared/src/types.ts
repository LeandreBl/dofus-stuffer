export type Stats = Record<string, number>;
export type Element = 'neutral' | 'earth' | 'fire' | 'water' | 'air';
export type SlotType = 'amulet' | 'ring' | 'hat' | 'cape' | 'belt' | 'boots' | 'weapon' | 'shield' | 'pet' | 'dofus';
export type Slot = 'amulet' | 'ring1' | 'ring2' | 'hat' | 'cape' | 'belt' | 'boots' | 'weapon' | 'shield' | 'pet' | 'dofus1' | 'dofus2' | 'dofus3' | 'dofus4' | 'dofus5' | 'dofus6';
export type ExoStat = 'actionPoints' | 'movementPoints';
export interface StatDefinition {
  key: string;
  id: number;
  name: string;
  category: string;
  icon?: string;
  iconSpriteY?: number;
  unit?: '%' | '';
  defaultTarget?: number;
}
export interface GameClass { id: number; name: string; icon: string; illustration?: string; }
export interface RawEffect {
  effectId: number;
  diceNum: number;
  diceSide: number;
  value: number;
  duration?: number;
  delay?: number;
  triggers?: string;
  targetMask?: string;
  description?: string;
  element?: Element;
  visibleInTooltip?: boolean;
  random?: number;
  group?: number;
  /** Native effect classification: false for equipment bonuses, true for combat effects. */
  isInFight?: boolean;
  order?: number;
  effectUid?: number;
  clientOnly?: boolean;
  triggerDuration?: number;
  zone?: { shape: number; radius: number; minRadius: number; falloff: number; maxFalloff: number };
}
export interface SpellLevel {
  id: number;
  grade: number;
  minPlayerLevel: number;
  apCost: number;
  minRange: number;
  range: number;
  rangeCanBeBoosted: boolean;
  criticalHitProbability: number;
  maxCastPerTurn: number;
  maxCastPerTarget: number;
  minCastInterval: number;
  maxStack?: number;
  statesCriterion?: string;
  effects: RawEffect[];
  criticalEffects: RawEffect[];
}
export interface Spell {
  id: number;
  name: string;
  description: string;
  classIds: number[];
  icon: string;
  levels: SpellLevel[];
  dataWarnings?: string[];
  balanceNotes?: string[];
}
export interface ItemCondition {
  kind: 'and' | 'or' | 'stat' | 'unknown';
  children?: ItemCondition[];
  stat?: string;
  operator?: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value?: number;
  description?: string;
}
export interface ItemPassive {
  id: number;
  name: string;
  description: string;
  /** Visible effects of the native passive and its branches, never equipment stats. */
  effects: RawEffect[];
}
export interface EquipmentItem {
  id: number;
  name: string;
  level: number;
  typeId: number;
  typeName: string;
  category: string;
  slotType: SlotType;
  stats: Stats;
  icon: string;
  setId?: number;
  conditions?: ItemCondition;
  conditionsText?: string;
  effects?: RawEffect[];
  passives?: ItemPassive[];
  unsupportedEffects?: string[];
  dataWarnings?: string[];
  forgeable?: boolean;
  weapon?: {
    apCost: number;
    minRange: number;
    range: number;
    criticalHitProbability: number;
    criticalHitBonus: number;
    maxCastPerTurn: number;
  };
}
export interface EquipmentSet {
  id: number;
  name: string;
  bonuses: { count: number; stats: Stats }[];
}
export interface Catalog {
  version: string;
  /** Hash of the snapshot used by a queued optimization. */
  revision?: string;
  fetchedAt: string;
  source: string;
  classes: GameClass[];
  stats: StatDefinition[];
  spells: Spell[];
  items: EquipmentItem[];
  sets: EquipmentSet[];
  servers: string[];
  warnings?: string[];
  /** Internal spells are dependencies, never entries in the character grimoire. */
  combatSpells?: Spell[];
  combatStates?: { id: number; name: string; effects: RawEffect[] }[];
  combatTargets?: { id: number; name: string }[];
  summons?: { id: number; name: string; spells: number[]; grades: { grade: number; level: number; stats: Stats; inheritedStats?: Stats }[] }[];
}
export interface SpellScenario {
  casterStates?: number[];
  targetStates?: number[];
  casterHpPercent?: number;
  casterErodedHp?: number;
  targetHp?: number;
  targetErodedHp?: number;
  targetMaxHp?: number;
  targetHpPercent?: number;
  targetKind?: 'monster' | 'character' | 'summon' | 'staticSummon' | 'companion';
  targetMonsterId?: number;
  targetClassId?: number;
  remainingMp?: number;
  usedAp?: number;
  usedMp?: number;
  initialReceivedDamage?: number;
  receivedElement?: Element;
  blockedPushCells?: number;
  pushResistance?: number;
  zoneDistance?: number;
  triggerCount?: number;
  baseDamageBonus?: number;
  receivedDamage?: number;
  summonSpellId?: number;
  summonHp?: number;
  /** Explicit selections for native conditions other than states. */
  conditions?: string[];
  randomChoices?: Record<string, number[]>;
  runes?: Partial<Record<Element, number>>;
  castSource?: number;
}
/** baseStats are invested characteristic values, before scrolls or equipment. */
export interface Character { classId: number; level: number; baseStats: Stats; scrollStats?: Stats; allocationMode?: 'automatic' | 'manual'; }
export interface CharacterAllocation {
  available: number;
  spent: number;
  remaining: number;
  valid: boolean;
  violations: string[];
}
export interface StatBreakdown {
  base: number;
  scroll: number;
  equipment: number;
  derived: number;
  power: number;
  total: number;
}
export interface CombatTarget {
  percent: Partial<Record<Element, number>>;
  flat: Partial<Record<Element, number>>;
  criticalResistance: number;
  distance: 'ranged' | 'melee';
}
export interface Constraint {
  id: string;
  kind: 'stat' | 'spell' | 'weapon' | 'price';
  statKey?: string;
  /** Include permanent power in an elemental characteristic objective, without changing real stats or prerequisites. */
  includePower?: boolean;
  spellId?: number;
  target: number;
  relation: 'atLeast' | 'atMost' | 'maximize' | 'minimize';
  priority: number;
  strict: boolean;
  mode?: 'normal' | 'critical';
  /** Damage roll by default, or the spell/weapon's effective critical chance in percent. */
  metric?: 'min' | 'average' | 'max' | 'criticalChance';
  turnOffset?: number;
  scenario?: SpellScenario;
}
export interface Build { slots: Partial<Record<Slot, number>>; exoBonuses?: ExoStat[]; baseStats?: Stats; }
export interface PriceBook {
  server: string;
  /** Manual overrides always take precedence over the server feed. */
  values: Record<string, number>;
  automaticValues?: Record<string, number>;
  automaticExoCosts?: Partial<Record<ExoStat, number>>;
  automaticUpdatedAt?: string;
  automaticSource?: string;
  ownedItemIds: number[];
  mode: 'total' | 'remaining';
  updatedAt?: string;
  /** Estimated extra cost per global exotic bonus, in addition to ordinary item prices. */
  exoCosts?: Partial<Record<ExoStat, number>>;
  ownedExos?: ExoStat[];
}
export interface OptimizationRequest {
  catalogRevision?: string;
  character: Character;
  constraints: Constraint[];
  target: CombatTarget;
  filters: {
    excludedItemIds: number[];
    excludedTypeIds: number[];
    excludedCategories: string[];
    lockedSlots: Partial<Record<Slot, number>>;
    allowedItemIds?: number[];
    allowedExos?: ExoStat[];
    /** Maximum number of global PA/PM bonuses (0, 1 or 2). Omitted legacy requests allow 2. */
    maxExos?: number;
  };
  prices: PriceBook;
  seconds: number;
  seed?: number;
  initialBuild?: Build;
}
export interface DamageRange { min: number; average: number; max: number; }
export interface DamageLine {
  element: Element;
  baseMin: number;
  baseMax: number;
  normal: DamageRange;
  critical: DamageRange | null;
  delay: number;
  label?: string;
  trigger?: string;
  duration?: number;
  sourceSpellId?: number;
  kind?: 'elemental' | 'push' | 'life';
}
export interface SpellDamage {
  spellId: number;
  levelId: number;
  apCost: number;
  critChance: number;
  normal: DamageRange;
  critical: DamageRange | null;
  expected: number;
  perAp: number;
  lines: DamageLine[];
  turns: { turn: number; bonus: number; normal: DamageRange; critical: DamageRange | null; available: boolean }[];
  supported: boolean;
  warnings: string[];
  scenarioOptions?: { key: string; label: string; role: 'caster' | 'target' | 'condition'; stateId?: number }[];
  parameters?: string[];
  summonAttacks?: { id: number; name: string; summon: string }[];
  castSources?: { id: number; name: string }[];
  zoneDistance?: number;
  damageKind?: 'direct' | 'triggered' | 'summon' | 'support';
  randomOptions?: { key: string; label: string; choices: {id:number;label:string}[]; draws:number }[];
}
export interface WeaponDamage {
  itemId: number;
  apCost: number;
  minRange: number;
  range: number;
  maxCastPerTurn: number;
  critChance: number;
  normal: DamageRange;
  critical: DamageRange | null;
  expected: number;
  perAp: number;
  lines: DamageLine[];
  supported: boolean;
  warnings: string[];
}
export interface ConstraintEvaluation { id: string; value: number | null; satisfied: boolean; supported: boolean; score: number; }
export interface EquipmentMaluses { stats: Stats; penalty: number; }
export interface BuildEvaluation {
  build: Build;
  stats: Stats;
  cost: number | null;
  knownCost: number;
  missingPrices: number[];
  sets: { id: number; name: string; count: number; stats: Stats }[];
  constraints: ConstraintEvaluation[];
  score: number;
  maluses: EquipmentMaluses;
  valid: boolean;
  violations: string[];
  warnings: string[];
  breakdown: Record<string, StatBreakdown>;
  characterPoints: CharacterAllocation;
  missingExoPrices: string[];
}
export interface JobProgress {
  percent: number;
  evaluated: number;
  feasible: number;
  elapsedMs: number;
  bestScore: number | null;
}
export interface JobSnapshot {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
  progress: JobProgress;
  results: BuildEvaluation[];
  message?: string;
  error?: string;
  catalogVersion: string;
  catalogRevision?: string;
}
export interface JobReceipt { id: string; token: string; status: JobSnapshot['status']; }
