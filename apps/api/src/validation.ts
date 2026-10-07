import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { canIncludePower, getCharacterAllocation, slotType, STAT_CAPS, type Catalog, type OptimizationRequest, type Slot } from '@dofus/shared';

const number = z.number().finite();
const id = number.int().positive().max(2_147_483_647);
const ids = z.array(id).max(10_000);
const slots = z.enum(['amulet', 'ring1', 'ring2', 'hat', 'cape', 'belt', 'boots', 'weapon', 'shield', 'pet',
  'dofus1', 'dofus2', 'dofus3', 'dofus4', 'dofus5', 'dofus6']);
const slotMap = z.record(slots, id);
const exo = z.enum(['actionPoints', 'movementPoints']);
const exos = z.array(exo).max(2).refine(values => new Set(values).size === values.length, 'Les types d’exos doivent être uniques.');
const elementMap = (min: number, max: number) => z.object({
  neutral: number.min(min).max(max).optional(), earth: number.min(min).max(max).optional(),
  fire: number.min(min).max(max).optional(), water: number.min(min).max(max).optional(),
  air: number.min(min).max(max).optional(),
}).strict();
const scenarioSchema = z.object({
  casterStates: z.array(id).max(100).optional(), targetStates: z.array(id).max(100).optional(),
  casterHpPercent: number.min(0).max(100).optional(), casterErodedHp: number.min(0).max(1_000_000).optional(),
  targetHp: number.min(0).max(1_000_000).optional(), targetMaxHp: number.min(0).max(1_000_000).optional(), targetErodedHp: number.min(0).max(1_000_000).optional(),
  targetHpPercent: number.min(0).max(100).optional(),
  targetKind: z.enum(['monster','character','summon','staticSummon','companion']).optional(),
  targetMonsterId: id.optional(), targetClassId: id.optional(),
  remainingMp: number.int().min(0).max(30).optional(), blockedPushCells: number.int().min(0).max(63).optional(),
  pushResistance: number.min(0).max(100_000).optional(), zoneDistance: number.int().min(0).max(63).optional(),
  triggerCount: number.int().min(0).max(20).optional(), baseDamageBonus: number.min(0).max(10_000).optional(),
  receivedDamage: number.min(0).max(1_000_000).optional(), summonSpellId: id.optional(), summonHp: number.min(0).max(1_000_000).optional(),
  conditions: z.array(z.string().max(100)).max(100).optional(),
  randomChoices: z.record(z.string().max(100),z.array(number.int().min(0).max(10_000)).max(20)).optional(),
  runes: z.object({earth:number.int().min(0).max(20).optional(),fire:number.int().min(0).max(20).optional(),water:number.int().min(0).max(20).optional(),air:number.int().min(0).max(20).optional()}).strict().optional(),
  castSource: id.optional(),
  usedAp:number.int().min(0).max(100).optional(), usedMp:number.int().min(0).max(100).optional(), initialReceivedDamage:number.min(0).max(1_000_000).optional(), receivedElement:z.enum(['neutral','earth','fire','water','air']).optional(),
}).strict();
const schema = z.object({
  catalogRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  character: z.object({
    classId: id, level: number.int().min(1).max(200),
    allocationMode: z.enum(['automatic', 'manual']).optional(),
    baseStats: z.record(z.string().min(1).max(80), number.min(-20_000).max(20_000)),
    scrollStats: z.record(z.string().min(1).max(80), number.int().min(0).max(100)).optional(),
  }).strict(),
  constraints: z.array(z.object({
    id: z.string().min(1).max(80), kind: z.enum(['stat', 'spell', 'weapon', 'price']),
    statKey: z.string().min(1).max(80).optional(), includePower: z.boolean().optional(), spellId: id.optional(),
    target: number.min(0).max(1_000_000_000_000), relation: z.enum(['atLeast', 'atMost', 'maximize', 'minimize']),
    priority: number.int().min(0).max(39), strict: z.boolean(), mode: z.enum(['normal', 'critical']).optional(),
    metric: z.enum(['min', 'average', 'max', 'criticalChance']).optional(), turnOffset: number.int().min(0).max(20).optional(),
    scenario: scenarioSchema.optional(),
  }).strict()).min(1).max(40),
  target: z.object({ percent: elementMap(-100, 100), flat: elementMap(0, 100_000),
    criticalResistance: number.min(0).max(100_000), distance: z.enum(['ranged', 'melee']) }).strict(),
  filters: z.object({ excludedItemIds: ids, excludedTypeIds: z.array(id).max(500),
    excludedCategories: z.array(z.string().min(1).max(80)).max(100), lockedSlots: slotMap,
    allowedItemIds: ids.optional(), allowedExos: exos.optional(), maxExos: number.int().min(0).max(2).optional() }).strict(),
  prices: z.object({ server: z.string().trim().min(1).max(80),
    values: z.record(z.string().regex(/^\d{1,10}$/), number.min(0).max(1_000_000_000_000)),
    ownedItemIds: ids, mode: z.enum(['total', 'remaining']), updatedAt: z.string().datetime().optional(),
    exoCosts: z.record(exo, number.min(0).max(1_000_000_000_000)).optional(),
    automaticValues: z.record(z.string().regex(/^\d{1,10}$/), number.min(0).max(1_000_000_000_000)).optional(),
    automaticExoCosts: z.record(exo, number.min(0).max(1_000_000_000_000)).optional(),
    automaticUpdatedAt: z.string().datetime().optional(), automaticSource: z.string().max(2_000).optional(),
    ownedExos: exos.optional() }).strict(),
  seconds: number.int().min(3).max(600), seed: number.int().min(0).max(4_294_967_295).optional(),
  initialBuild: z.object({ slots: slotMap, exoBonuses: exos.optional(),
    baseStats: z.record(z.string().min(1).max(80), number.int().min(0).max(1_000)).optional() }).strict().optional(),
}).strict();

export function validateRequest(body: unknown, catalog: Catalog): OptimizationRequest {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ message: 'Paramètres de recherche invalides.',
      details: parsed.error.issues.slice(0, 8).map(issue => `${issue.path.join('.')}: ${issue.message}`) });
  }
  const request = parsed.data as OptimizationRequest;
  const statKeys = new Set(catalog.stats.map(stat => stat.key));
  const itemIds = new Set(catalog.items.map(item => item.id));
  const itemsById = new Map(catalog.items.map(item => [item.id, item]));
  const spellIds = new Set(catalog.spells.map(spell => spell.id));
  const errors: string[] = [];
  if (request.catalogRevision && request.catalogRevision !== catalog.revision) errors.push('Le catalogue a changé. Actualisez la page avant de relancer une recherche.');
  if (!catalog.classes.some(entry => entry.id === request.character.classId)) errors.push('Classe inconnue.');
  const automatic = request.character.allocationMode === 'automatic';
  errors.push(...getCharacterAllocation({ ...request.character, baseStats: automatic ? {} : request.character.baseStats }).violations);
  if (request.initialBuild?.baseStats) {
    const initialAllocation = getCharacterAllocation({ ...request.character, baseStats: request.initialBuild.baseStats });
    if (!initialAllocation.valid && automatic) delete request.initialBuild.baseStats;
    else errors.push(...initialAllocation.violations);
  }
  if (Object.keys(request.character.baseStats).length > 100) errors.push('Trop de caractéristiques de base.');
  for (const key of Object.keys(request.character.baseStats)) {
    if (!statKeys.has(key)) errors.push(`Caractéristique inconnue : ${key}.`);
    if (!['strength', 'intelligence', 'chance', 'agility', 'vitality', 'wisdom'].includes(key)) errors.push('Seules les six caractéristiques augmentables peuvent être renseignées comme caractéristiques de base.');
  }
  for (const key of Object.keys(request.character.scrollStats || {})) {
    if (!['strength', 'intelligence', 'chance', 'agility', 'vitality', 'wisdom'].includes(key)) errors.push('Le parchottage concerne uniquement les six caractéristiques augmentables.');
  }
  if (new Set(request.constraints.map(constraint => constraint.id)).size !== request.constraints.length) errors.push('Les critères doivent avoir des identifiants uniques.');
  for (const constraint of request.constraints) {
    if (constraint.kind === 'stat' && (!constraint.statKey || !statKeys.has(constraint.statKey))) errors.push('Caractéristique de critère inconnue.');
    if (constraint.includePower !== undefined && !canIncludePower(constraint)) errors.push('L’option « Avec puissance » concerne uniquement la Force, l’Intelligence, la Chance et l’Agilité.');
    if (constraint.scenario !== undefined && (constraint.kind !== 'spell' || constraint.metric === 'criticalChance')) errors.push('La situation de combat concerne uniquement un objectif de dégâts de sort.');
    const statMaximum = constraint.kind === 'stat' ? STAT_CAPS[constraint.statKey || ''] : undefined;
    if (statMaximum !== undefined && ['atLeast', 'atMost'].includes(constraint.relation) && constraint.target > statMaximum) {
      const stat = catalog.stats.find(entry => entry.key === constraint.statKey);
      errors.push(`La cible ${stat?.name || constraint.statKey} ne peut pas dépasser ${statMaximum}${constraint.statKey?.endsWith('ResistPercent') ? ' %' : ''}.`);
    }
    if (constraint.kind === 'spell' && (!constraint.spellId || !spellIds.has(constraint.spellId))) errors.push('Sort de critère inconnu.');
    if (constraint.kind === 'weapon' && (constraint.spellId !== undefined || constraint.statKey !== undefined || constraint.turnOffset !== undefined)) {
      errors.push('Un objectif d’arme concerne l’arme équipée, sans sort, caractéristique ni tour de relance.');
    }
    if (constraint.metric === 'criticalChance') {
      if (constraint.kind !== 'spell' && constraint.kind !== 'weapon') errors.push('La chance de critique doit concerner un sort ou l’arme équipée.');
      if (constraint.target > 100) errors.push('La chance de critique doit être comprise entre 0 et 100 %.');
      if (constraint.mode !== undefined || constraint.turnOffset !== undefined) errors.push('La chance de critique ne dépend ni du jet de dégâts ni du tour de relance.');
    }
    if (constraint.strict && ['maximize', 'minimize'].includes(constraint.relation)) errors.push('Un critère obligatoire doit définir un seuil.');
  }
  const referencedItems = [
    ...request.filters.excludedItemIds, ...(request.filters.allowedItemIds || []),
    ...Object.values(request.filters.lockedSlots), ...Object.values(request.initialBuild?.slots || {}),
    ...request.prices.ownedItemIds,
  ];
  if (referencedItems.some(value => value !== undefined && !itemIds.has(value))) errors.push('Un objet référencé est absent du catalogue courant.');
  const lockedEntries = Object.entries(request.filters.lockedSlots);
  for (const itemId of new Set(lockedEntries.map(([, value]) => value))) {
    const entries = lockedEntries.filter(([, value]) => value === itemId);
    const item = itemsById.get(itemId!);
    const legalRingPair = item?.slotType === 'ring' && !item.setId && entries.length === 2
      && entries.every(([slot]) => slot === 'ring1' || slot === 'ring2');
    if (entries.length > 1 && !legalRingPair) errors.push('Un même objet ne peut pas être verrouillé dans plusieurs emplacements, sauf un anneau hors panoplie.');
  }
  for (const [slot, itemId] of Object.entries(request.filters.lockedSlots)) {
    const item = itemsById.get(itemId!);
    if (!item) continue;
    if (item.slotType !== slotType(slot as Slot)) errors.push('Un objet verrouillé ne correspond pas à son emplacement.');
    if (item.level > request.character.level) errors.push('Un objet verrouillé dépasse le niveau du personnage.');
    // Type and category exclusions only apply to the free slots; a lock overrides them for this item.
    if (request.filters.excludedItemIds.includes(item.id)
      || (request.filters.allowedItemIds && !request.filters.allowedItemIds.includes(item.id))) errors.push('Un objet verrouillé est également exclu.');
  }
  if (request.initialBuild?.exoBonuses?.some(bonus => !request.filters.allowedExos?.includes(bonus))) errors.push('Un bonus exo du stuff initial n’est pas autorisé.');
  if ((request.initialBuild?.exoBonuses?.length || 0) > (request.filters.maxExos ?? 2)) errors.push('Le stuff initial dépasse le nombre d’exos autorisés.');
  for (const values of [request.prices.values, request.prices.automaticValues || {}]) {
    if (Object.keys(values).length > 10_000) errors.push('Maximum 10 000 prix par recherche.');
    if (Object.keys(values).some(key => !itemIds.has(Number(key)))) errors.push('Un prix référence un objet inconnu.');
  }
  if (errors.length) throw new BadRequestException({ message: 'Paramètres de recherche invalides.', details: [...new Set(errors)].slice(0, 8) });
  return request;
}
