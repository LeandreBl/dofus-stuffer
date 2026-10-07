import { z } from 'zod';
import type { Catalog } from '@dofus/shared';

const number = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const id = z.number().int().nonnegative().max(1_000_000_000);
const text = z.string().max(50_000);
const stats = z.record(z.string().max(150), number).refine(v => Object.keys(v).length <= 300);
const effect = z.object({ effectId: id, diceNum: number, diceSide: number, value: number,
  duration: number.optional(), delay: number.optional(), triggers: text.optional(), targetMask: text.optional(),
  description: text.optional(), element: z.enum(['neutral','earth','fire','water','air']).optional(),
  visibleInTooltip: z.boolean().optional(), random: number.optional(), group: number.optional(), isInFight: z.boolean().optional(),
  order:number.optional(), effectUid:id.optional(), clientOnly:z.boolean().optional(), triggerDuration:number.optional(),
  zone:z.object({shape:id,radius:number,minRadius:number,falloff:number,maxFalloff:number}).strict().optional(),
}).passthrough();
const condition: z.ZodTypeAny = z.lazy(() => z.object({ kind: z.enum(['and','or','stat','unknown']),
  children: z.array(condition).max(100).optional(), stat: z.string().max(150).optional(),
  operator: z.enum(['>','<','=','>=','<=','!=']).optional(), value: number.optional(), description: text.optional(),
}).passthrough());
const schema = z.object({
  version: z.string().regex(/^\d+(?:\.\d+){1,5}$/), fetchedAt: z.string().datetime(), source: text,
  classes: z.array(z.object({ id, name: text, icon: text, illustration: text.optional() }).passthrough()).min(1).max(100),
  stats: z.array(z.object({ key: z.string().min(1).max(150), id: z.number().int(), name: text, category: text,
    icon: text.optional(), iconSpriteY: number.optional(), unit: z.enum(['%','']).optional(), defaultTarget: number.optional(),
  }).passthrough()).min(1).max(500),
  spells: z.array(z.object({ id, name: text, description: text, classIds: z.array(id).max(100), icon: text,
    levels: z.array(z.object({ id, grade: id, minPlayerLevel: id, apCost: number, minRange: number, range: number,
      rangeCanBeBoosted: z.boolean(), criticalHitProbability: z.number().min(0).max(100), maxCastPerTurn: number,
      maxCastPerTarget: number, minCastInterval: number, maxStack: number.optional(),
      effects: z.array(effect).max(500), criticalEffects: z.array(effect).max(500),
    }).passthrough()).min(1).max(50), dataWarnings: z.array(text).max(100).optional(),
  }).passthrough()).min(1).max(30_000),
  items: z.array(z.object({ id, name: text, level: z.number().int().min(1).max(200), typeId: id, typeName: text,
    category: text, slotType: z.enum(['amulet','ring','hat','cape','belt','boots','weapon','shield','pet','dofus']),
    stats, icon: text, setId: id.optional(), conditions: condition.optional(), conditionsText: text.optional(),
    effects: z.array(effect).max(500).optional(), unsupportedEffects: z.array(text).max(500).optional(),
    passives: z.array(z.object({ id, name: text, description: text, effects: z.array(effect).max(500) }).strict()).max(20).optional(),
    dataWarnings: z.array(text).max(100).optional(), forgeable: z.boolean().optional(),
    weapon: z.object({ apCost: z.number().int().min(0).max(100), minRange: z.number().int().min(0).max(100),
      range: z.number().int().min(0).max(100), criticalHitProbability: z.number().int().min(0).max(100),
      criticalHitBonus: z.number().int().min(-1_000).max(1_000), maxCastPerTurn: z.number().int().min(0).max(100),
    }).strict().refine(weapon => weapon.range >= weapon.minRange).optional(),
  }).passthrough()).min(1).max(100_000),
  sets: z.array(z.object({ id, name: text, bonuses: z.array(z.object({ count: z.number().int().min(1).max(20), stats }).passthrough()).max(20) }).passthrough()).max(20_000),
  servers: z.array(z.string().min(1).max(100)).min(1).max(300), warnings: z.array(text).max(1000).optional(),
  combatSpells:z.array(z.object({id,name:text,description:text,classIds:z.array(id).max(100),icon:text.optional(),levels:z.array(z.object({id,grade:id,minPlayerLevel:id,apCost:number,minRange:number,range:number,rangeCanBeBoosted:z.boolean(),criticalHitProbability:z.number().min(0).max(100),maxCastPerTurn:number,maxCastPerTarget:number,minCastInterval:number,effects:z.array(effect).max(500),criticalEffects:z.array(effect).max(500)}).passthrough()).max(50)}).passthrough()).max(30_000).optional(),
  combatStates:z.array(z.object({id,name:text,effects:z.array(effect).max(500)}).strict()).max(20_000).optional(),
  combatTargets:z.array(z.object({id,name:text}).strict()).max(20_000).optional(),
  summons:z.array(z.object({id,name:text,spells:z.array(id).max(100),grades:z.array(z.object({grade:id,level:id,stats,inheritedStats:stats.optional()}).strict()).max(50)}).strict()).max(20_000).optional(),
}).passthrough();

export function validateCatalog(input: unknown): Catalog {
  // Bound recursive condition depth before Zod's recursive traversal.
  const checkDepth = (value: unknown, depth = 0): void => {
    if (depth > 35) throw new Error('Catalogue trop imbriqué.');
    if (value && typeof value === 'object') for (const child of Object.values(value)) checkDepth(child, depth + 1);
  };
  checkDepth(input);
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Catalogue incomplet ou invalide : données conservées.');
  const catalog = result.data as Catalog;
  const unique = (entries: { id: number }[]) => new Set(entries.map(x => x.id)).size === entries.length;
  if (![catalog.items, catalog.spells, catalog.classes, catalog.sets].every(unique)
    || new Set(catalog.stats.map(s => s.key)).size !== catalog.stats.length) throw new Error('Identifiants de catalogue dupliqués.');
  for(const entries of [catalog.combatSpells,catalog.combatStates,catalog.combatTargets,catalog.summons])if(entries&&!unique(entries))throw new Error('Identifiants de simulation dupliqués.');
  const keys = new Set(catalog.stats.map(s => s.key)), classes = new Set(catalog.classes.map(c => c.id));
  for (const item of catalog.items) if (Object.keys(item.stats).some(key => !keys.has(key))) throw new Error('Caractéristique d’objet inconnue.');
  for (const set of catalog.sets) for (const bonus of set.bonuses) if (Object.keys(bonus.stats).some(key => !keys.has(key))) throw new Error('Caractéristique de panoplie inconnue.');
  for (const spell of catalog.spells) if (spell.classIds.some(c => !classes.has(c))) throw new Error('Classe de sort inconnue.');
  return catalog;
}

const price = z.number().finite().int().min(0).max(1_000_000_000_000);
const serverPrices = z.object({ values: z.record(z.string().regex(/^\d+$/), price),
  exoCosts: z.object({ actionPoints: price.optional(), movementPoints: price.optional() }).strict().optional(),
}).strict();
export const priceSchema = z.object({ updatedAt: z.string().datetime(), servers: z.record(z.string().min(1).max(100), serverPrices) }).strict();
export type PriceFeed = z.infer<typeof priceSchema>;
export function validatePrices(input: unknown, catalog: Catalog, now = Date.now()): PriceFeed {
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) throw new Error('Flux de prix invalide : anciens prix conservés.');
  const feed = parsed.data, ids = new Set(catalog.items.map(item => item.id));
  if (Date.parse(feed.updatedAt) > now + 86_400_000 || !Object.keys(feed.servers).length || Object.keys(feed.servers).length > 300) throw new Error('Date ou serveurs du flux de prix invalides.');
  for (const [server, book] of Object.entries(feed.servers)) {
    if (!catalog.servers.includes(server) || Object.keys(book.values).length > catalog.items.length
      || Object.keys(book.values).some(key => String(Number(key)) !== key || !ids.has(Number(key)))) throw new Error('Serveur ou objet de prix inconnu.');
    if (!Object.keys(book.values).length && !Object.keys(book.exoCosts || {}).length) throw new Error('Prix de serveur vides.');
  }
  return feed;
}
