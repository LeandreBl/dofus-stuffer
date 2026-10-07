/** Import static game data from a read-only client export or the public DofusDB API. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { applyPatch37 } from '../data/patches/3.7.mjs';
import { normalizeWeaponMetadata, effectFightUsage, effectsForEquipmentStats, WEAPON_FIELDS } from './equipment-metadata.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = process.argv.find(a=>a.startsWith('--output-root='))?.slice('--output-root='.length);
const OUTPUT_ROOT = outputRoot ? resolve(outputRoot) : ROOT;
const API = 'https://api.dofusdb.fr';
const args = new Set(process.argv.slice(2));
const refresh = args.has('--refresh');
const rawOnly = args.has('--raw-only');
const offline = args.has('--offline');
const skipAssets = args.has('--skip-assets');
const currentCatalogPath = process.argv.find(a=>a.startsWith('--current-catalog='))?.slice('--current-catalog='.length);
const currentCatalog = currentCatalogPath ? JSON.parse(await readFile(resolve(currentCatalogPath),'utf8')) : undefined;
const knownAssets = new Set((currentCatalog ? [...currentCatalog.classes,...currentCatalog.spells,...currentCatalog.items] : []).flatMap(r=>[r.icon,r.illustration]).filter(url=>typeof url==='string' && url.startsWith('/game/')));
const localClientPath = process.argv.find(a=>a.startsWith('--local-client-data='))?.slice('--local-client-data='.length);
const localClient = localClientPath ? JSON.parse(await readFile(resolve(localClientPath),'utf8')) : undefined;
const ASSET_API = localClient ? 'https://api.beta.dofusdb.fr' : API;
if (localClient) {
  const effect = e => ({...e,effectId:e.actionId,visibleInTooltip:Boolean(e.m_flags & 1)});
  for (const l of localClient.resources['spell-levels']) {
    l.rangeCanBeBoosted=Boolean(l.m_flags & 64);
    l.effects=l.effects.map(effect);l.criticalEffect=l.criticalEffect.map(effect);
  }
  for (const i of localClient.resources.items) {
    i.possibleEffects=i.possibleEffects.map(effect);
    i.enhanceable=Boolean(i.m_flags & 64);i.isLegendary=Boolean(i.m_flags & 2048);
  }
  for (const s of localClient.resources['item-sets']) s.effects=s.effects.map(e=>e.values.map(effect));
  for (const b of localClient.resources.breeds) {
    b.img=`${API}/img/breeds/symbol_${b.id}.png`;
    b.imgTransparent=`${API}/img/breeds/logo_transparent_${b.id}.png`;
    b.heads={male:`${API}/img/heads/SmallHead_${b.maleLook.split('|')[1].split(',')[0]}.png`};
  }
}
const ASSETS = resolve(OUTPUT_ROOT, 'apps/web/public/game');
const CACHE = resolve(OUTPUT_ROOT, 'data/.cache');
await mkdir(CACHE, { recursive: true });
if (!skipAssets) await mkdir(ASSETS, { recursive: true });

async function remote(url, binary = false) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'DofusStuffer-data-import/1.0' } });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(done => setTimeout(done, 500 * (attempt + 1)));
    }
  }
}
async function cached(key, loader) {
  const path = resolve(CACHE, `${key}.json`);
  if (!refresh || offline) {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch {}
  }
  if (offline) throw new Error(`Cache absent : ${key}`);
  const value = await loader();
  await writeFile(path, JSON.stringify(value));
  return value;
}
async function pooled(values, fn, count = 4) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(count, values.length) }, async () => {
    while (next < values.length) { const i = next++; results[i] = await fn(values[i], i); }
  }));
  return results;
}
async function list(resource, params = {}, select = []) {
  if (localClient) {
    if (!Array.isArray(localClient.resources[resource])) throw new Error(`Ressource native absente : ${resource}`);
    return localClient.resources[resource].filter(row=>Object.entries(params).every(([key,value])=>{
      if(key.endsWith('[$lte]'))return row[key.slice(0,-6)]<=value;
      return Array.isArray(value)?value.includes(row[key]):row[key]===value;
    })).sort((a,b)=>a.id-b.id);
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(v => query.append(`${key}[$in][]`, v));
    else query.append(key, String(value));
  }
  for (const field of select) query.append('$select[]', field);
  query.set('$limit', '50');
  query.set('$sort[id]', '1');
  const key = `${resource}-${createHash('sha1').update(query.toString()).digest('hex').slice(0, 10)}`;
  return cached(key, async () => {
    const first = await remote(`${API}/${resource}?${query}`);
    if (!Array.isArray(first.data)) throw new Error(`Format inconnu ${resource}`);
    const skips = Array.from({length: Math.ceil(Math.max(0, first.total - first.data.length) / first.limit)}, (_,i) => first.limit * (i+1));
    const rest = await pooled(skips, async skip => {
      const page = new URLSearchParams(query); page.set('$skip', String(skip));
      return (await remote(`${API}/${resource}?${page}`)).data;
    });
    const data = first.data.concat(...rest);
    if (data.length !== first.total) throw new Error(`${resource}: attendu ${first.total}, reçu ${data.length}`);
    console.log(`${resource}: ${data.length}`);
    return data;
  });
}
const version = localClient?.version ?? await cached('version', () => remote(`${API}/version`));
const expectedVersion = process.argv.find(a=>a.startsWith('--expected-version='))?.split('=')[1];
if (expectedVersion && version !== expectedVersion) throw new Error(`Version attendue ${expectedVersion}, source ${version}`);
console.log(`${localClient?'Client Ankama':'DofusDB'} ${version}`);
const [breeds, characteristics, effectDefinitions, itemTypes, variants] = await Promise.all([
  list('breeds'), list('characteristics'),
  list('effects', {}, ['id','description','characteristic','characteristicOperator','bonusType','elementId','isInPercent']),
  list('item-types'), list('spell-variants', {}, ['id','breedId','spellIds']),
]);
await writeFile(resolve(CACHE, 'characteristics-latest.json'), JSON.stringify(characteristics));
await writeFile(resolve(CACHE, 'effects-latest.json'), JSON.stringify(effectDefinitions));
const classOf = new Map();
for (const breed of breeds) for (const id of breed.breedSpellsId ?? []) classOf.set(id, new Set([...(classOf.get(id) ?? []), breed.id]));
for (const variant of variants) if (breeds.some(b => b.id === variant.breedId)) for (const id of variant.spellIds) classOf.set(id, new Set([...(classOf.get(id) ?? []), variant.breedId]));
// Ordinary common spells are identified by their actual spell type, not by invented ids.
const commonTypes = await list('spell-types', {'id[$lte]': 30});
const commonTypeIds = commonTypes.filter(t => /commun|spécial/i.test(t.longName?.fr ?? '')).map(t => t.id);
const commonSpells = commonTypeIds.length ? await list('spells', {typeId: commonTypeIds}) : [];
const requested = [...new Set([...classOf.keys(), ...commonSpells.map(s => s.id)])];
const chunks = (values, n=35) => Array.from({length: Math.ceil(values.length/n)}, (_, i) => values.slice(i*n, (i+1)*n));
const spellsRaw = (await pooled(chunks(requested), ids => list('spells', {id: ids}), 3)).flat();
const levelsRaw = (await pooled(chunks([...new Set(spellsRaw.flatMap(s => s.spellLevels))]), ids => list('spell-levels', {id: ids}), 3)).flat();
const slotForSuperType = {1:'amulet',2:'weapon',3:'ring',4:'belt',5:'boots',7:'shield',10:'hat',11:'cape',12:'pet',13:'dofus'};
const wearableTypes = itemTypes.filter(t => t.categoryId === 0 && slotForSuperType[t.superTypeId]);
const itemsRaw = await list('items', {typeId: wearableTypes.map(t => t.id)}, ['id','typeId','iconId','level','itemSetId','criterions','possibleEffects','effects','name','description','isLegendary','isSaleable','enhanceable','etheral',...WEAPON_FIELDS]);
const passiveIds = [...new Set(itemsRaw.flatMap(item => (item.possibleEffects ?? []).filter(effect => effect.effectId === 1175).map(effect => effect.diceNum)).filter(id => id > 0))];
const passivesRaw = (await pooled(chunks(passiveIds), ids => list('spells', {id: ids}), 3)).flat();
const passiveLevelsRaw = (await pooled(chunks([...new Set(passivesRaw.flatMap(spell => spell.spellLevels))]), ids => list('spell-levels', {id: ids}), 3)).flat();
const setsRaw = await list('item-sets', {}, ['id','name','effects']);
await writeFile(resolve(CACHE, 'raw-latest.json'), JSON.stringify({version,breeds,characteristics,effectDefinitions,itemTypes,variants,spellsRaw,levelsRaw,itemsRaw,setsRaw}));
console.log(`Données récupérées : ${spellsRaw.length} sorts, ${levelsRaw.length} rangs, ${itemsRaw.length} objets.`);
if (rawOnly) process.exit(0);

// Normalisation follows the shared TypeScript contract; values remain traceable to the snapshot.
const fr = value => typeof value === 'string' ? value : value?.fr ?? value?.en ?? '';
const charsById = new Map(characteristics.map(c => [c.id,c]));
const effectsById = new Map(effectDefinitions.map(e => [e.id,e]));
const typesById = new Map(itemTypes.map(t => [t.id,t]));
const elementNames = ['neutral','earth','fire','water','air'];
const rawEffects = (effects, includeFightUsage = false) => (effects ?? []).map(e => ({
  effectId:e.effectId, diceNum:e.diceNum ?? e.from ?? 0, diceSide:e.diceSide ?? e.to ?? 0,
  value:e.value ?? 0, duration:e.duration ?? 0, delay:e.delay ?? 0, triggers:e.triggers ?? '',
  targetMask:e.targetMask ?? '', element:elementNames[e.effectElement >= 0 ? e.effectElement : effectsById.get(e.effectId)?.elementId],
  description:fr(effectsById.get(e.effectId)?.description), visibleInTooltip:e.visibleInTooltip !== false,
  random:e.random ?? 0, group:e.group ?? 0,
  order:e.order, effectUid:e.effectUid,
  clientOnly:e.forClientOnly ?? (Number.isInteger(e.m_flags) ? Boolean(e.m_flags & 16) : false), triggerDuration:e.effectTriggerDuration,
  ...(e.zoneDescr ? {zone:{shape:e.zoneDescr.shape,radius:e.zoneDescr.param1,minRadius:e.zoneDescr.param2,falloff:e.zoneDescr.damageDecreaseStepPercent,maxFalloff:e.zoneDescr.maxDamageDecreaseApplyCount}} : {}),
  ...(includeFightUsage ? {isInFight:effectFightUsage(effectsById.get(e.effectId))} : {}),
}));
function statsFrom(effects) {
  const stats = {};
  for (const e of effects ?? []) {
    const def = effectsById.get(e.effectId);
    const key = charsById.get(e.characteristic ?? def?.characteristic)?.keyword;
    if (!key || !def || !['+','-'].includes(def.characteristicOperator) || def.characteristic === 0) continue;
    const low = e.diceNum ?? e.from ?? e.value ?? 0;
    const high = e.diceSide ?? e.to ?? 0;
    // Natural maximum jets: the smallest negative penalty is the best possible roll.
    const value = def.characteristicOperator === '-' ? -Math.min(low, high || low) : Math.max(low, high);
    stats[key] = (stats[key] ?? 0) + value;
  }
  return stats;
}

// Deliberately no eval: unknown game prerequisites stay explicit and fail conservatively.
const conditionKeys = {CS:'strength',CI:'intelligence',CC:'chance',CA:'agility',CV:'vitality',CW:'wisdom',CP:'actionPoints',CM:'movementPoints',Pk:'setBonus',pk:'activeSetCount',PL:'level',PG:'classId'};
function parseCondition(text) {
  if (!text) return undefined;
  let cursor=0;
  function atom() {
    if (text[cursor]==='(') { cursor++; const result=or(); if(text[cursor++]!==')') throw new Error('parenthesis');return result; }
    const match=text.slice(cursor).match(/^([A-Za-z]{2})(>=|<=|!=|[<>=!~])(-?\d+)/);
    if (!match) throw new Error('unknown condition');
    cursor+=match[0].length;
    const stat=conditionKeys[match[1]];
    if (!stat || match[2]==='~') return {kind:'unknown',description:match[0]};
    return {kind:'stat',stat,operator:match[2]==='!'?'!=':match[2],value:Number(match[3])};
  }
  function and(){const children=[atom()];while(text[cursor]==='&'){cursor++;children.push(atom());}return children.length===1?children[0]:{kind:'and',children};}
  function or(){const children=[and()];while(text[cursor]==='|'){cursor++;children.push(and());}return children.length===1?children[0]:{kind:'or',children};}
  try {const result=or();if(cursor!==text.length)throw new Error('unparsed');return result;}catch{return {kind:'unknown',description:text};}
}

// Asset installation is completed below; never fabricate a broken local URL.
const assetManifest = [];
if(skipAssets && OUTPUT_ROOT===ROOT) {
  try { assetManifest.push(...JSON.parse(await readFile(resolve(ROOT,'data/asset-sources.json'),'utf8'))); } catch {}
}
async function asset(url, filename) {
  // A weekly catalogue refresh must not rewrite the immutable web image bundle.
  // Missing new images use the interface's built-in placeholder until a web rebuild.
  if (skipAssets) return knownAssets.has(`/game/${filename}`) ? `/game/${filename}` : '';
  const dest = resolve(ASSETS,filename);
  await mkdir(dirname(dest), {recursive:true});
  try {
    if (!refresh) { try { await readFile(dest); assetManifest.push({file:`/game/${filename}`,source:url}); return `/game/${filename}`; } catch {} }
    if (offline) return url;
    const buffer = await remote(url,true);
    await writeFile(dest,buffer);
    assetManifest.push({file:`/game/${filename}`,source:url});
    return `/game/${filename}`;
  } catch (error) { console.warn(`Image indisponible : ${url}`); return url; }
}
const classes = await pooled(breeds, async b => {
  const symbol=await asset(b.imgTransparent,`classes/symbol-${b.id}.png`);
  // Public sprite URLs are documented by DofusLab's update_class_list.py and getImageUrl.
  const sprite=await asset(`https://d2iuiayak06k8j.cloudfront.net/class/sprite/${b.shortName.en}_M.png`,`classes/portrait-${b.id}.png`);
  const illustration=sprite.startsWith('/game/')?sprite:symbol;
  const icon=await asset(b.heads?.male ?? b.img,`classes/${b.id}.png`);
  return {id:b.id,name:fr(b.shortName),icon:icon.startsWith('/game/')?icon:symbol,illustration};
});
const spellIcons = new Map();
await pooled([...new Set(spellsRaw.map(s => s.iconId))], async id => spellIcons.set(id, await asset(`${ASSET_API}/img/spells/sort_${id}.png`,`spells/${id}.png`)), 6);
const levelsBySpell = new Map();
for (const l of levelsRaw) { if (!levelsBySpell.has(l.spellId)) levelsBySpell.set(l.spellId, []); levelsBySpell.get(l.spellId).push(l); }
const normalizeSpell = (s, spellLevels) => ({
  id:s.id,name:fr(s.name),description:fr(s.description),classIds:[...(classOf.get(s.id) ?? [])],icon:spellIcons.get(s.iconId)??'',
  levels:[...spellLevels].sort((a,b)=>a.grade-b.grade).map(l => ({
    id:l.id,grade:l.grade,minPlayerLevel:l.minPlayerLevel,apCost:l.apCost,minRange:l.minRange,range:l.range,
    rangeCanBeBoosted:l.rangeCanBeBoosted,criticalHitProbability:l.criticalHitProbability,minCastInterval:l.minCastInterval,
    maxCastPerTurn:l.maxCastPerTurn,maxCastPerTarget:l.maxCastPerTarget,maxStack:l.maxStack,
    statesCriterion:l.statesCriterion,
    effects:rawEffects(l.effects),criticalEffects:rawEffects(l.criticalEffect),
  })),
});
const spells = spellsRaw.map(s => normalizeSpell(s, levelsBySpell.get(s.id) ?? []));
// Follow native references. No damage numbers are synthesized from descriptions.
const references = new Set([400,401,402,1091,1165,2022,792,1017,1019,1160,2160,2792,2794,2795,2960]);
const combatSpells = [], summons = [], combatStates = [], combatTargets = [];
if (localClient) {
  const allSpells = new Map(localClient.resources.spells.map(s => [s.id,s]));
  const allLevels = new Map(localClient.resources['spell-levels'].map(l => [l.id,l]));
  const allMonsters = new Map((localClient.resources.monsters ?? []).map(m => [m.id,m]));
  const visited = new Set(), monsters = new Set(), states = new Set(), targetMonsters = new Set();
  const queue = [...requested,...passiveIds];
  while(queue.length) {
    const id=queue.shift(); if(visited.has(id))continue; visited.add(id);
    const raw=allSpells.get(id); if(!raw)continue;
    const normalized=normalizeSpell(raw,raw.spellLevels.map(id=>allLevels.get(id)).filter(Boolean));
    combatSpells.push(normalized);
    for(const level of normalized.levels) {
      for(const match of (level.statesCriterion ?? '').matchAll(/HS[=!](\d+)/g))states.add(Number(match[1]));
      for(const e of [...level.effects,...level.criticalEffects]) {
        if(references.has(e.effectId) && e.diceNum>0)queue.push(e.diceNum);
        if(e.effectId===1026 && e.value>0)queue.push(e.value);
        if(e.effectId===2023)queue.push(13690,13665,13688,13689);
        for(const match of (e.targetMask ?? '').matchAll(/\*?[Ee](\d+)/g))states.add(Number(match[1]));
        for(const match of (e.targetMask ?? '').matchAll(/\*?[Ff](\d+)/g))targetMonsters.add(Number(match[1]));
        if([950,951,952].includes(e.effectId))states.add(e.value);
        if([181,1008,1011,405,2796].includes(e.effectId) && !monsters.has(e.diceNum)) {
          monsters.add(e.diceNum);const monster=allMonsters.get(e.diceNum);if(!monster)continue;
          const keys={lifePoints:'hitPoints',damageBonus:'allDamageBonus',percentDamageBonus:'damagePercent',trapDamageBonus:'trapDamageBonus',trapDamageBonusPercent:'trapDamageBonusPercent',criticalHitBonus:'criticalHit',criticalDamageBonus:'criticalDamageBonus',pushDamageBonus:'pushDamageBonus'};
          const statKeys=['lifePoints','strength','intelligence','chance','agility','damageBonus','percentDamageBonus','criticalDamageBonus','pushDamageBonus','earthDamageBonus','fireDamageBonus','waterDamageBonus','airDamageBonus','neutralDamageBonus','criticalHitBonus'];
          summons.push({id:monster.id,name:fr(monster.name),spells:monster.spells,grades:monster.grades.map(g=>({grade:g.grade,level:g.level,stats:Object.fromEntries(statKeys.map(key=>[keys[key] ?? key,g[key] ?? 0])),inheritedStats:Object.fromEntries(statKeys.filter(key=>g.bonusCharacteristics?.[key]).map(key=>[keys[key] ?? key,g.bonusCharacteristics[key]]))}))});
          queue.push(...monster.spells);
        }
      }
    }
  }
  for(const state of localClient.resources['spell-states'] ?? []) if(states.has(state.id)) {
    const stateLevel=allLevels.get(state.spellLevelId);
    combatStates.push({id:state.id,name:fr(state.name),effects:rawEffects(stateLevel?.effects)});
  }
  for(const id of targetMonsters) { const monster=allMonsters.get(id); if(monster)combatTargets.push({id,name:fr(monster.name)}); }
  console.log(`Simulation : ${combatSpells.length} sorts internes, ${combatStates.length} états, ${summons.length} invocations.`);
}
// Every class-equipment spell modifier matters for range, cost, cooldown or damage targets.
const passiveEffectIds = new Set([1161,1175,...Array.from({length:20},(_,i)=>280+i)]);
const passivesById = new Map(passivesRaw.map(spell => [spell.id, {
  id:spell.id,name:fr(spell.name),description:fr(spell.description),
  effects:[...new Map(rawEffects(passiveLevelsRaw.filter(level => level.spellId === spell.id).flatMap(level => level.effects ?? [])).filter(effect => effect.visibleInTooltip).map(effect => [JSON.stringify(effect),effect])).values()],
}]));
const items = itemsRaw.map(i => ({
  id:i.id,name:fr(i.name),level:i.level,
  typeId:i.typeId,typeName:fr(typesById.get(i.typeId)?.name),category:i.typeId===23?'Dofus':i.typeId===151?'Trophées':i.typeId===217?'Prysmaradites':slotForSuperType[typesById.get(i.typeId)?.superTypeId]==='pet'?'Familiers et montures':'Équipements',slotType:slotForSuperType[typesById.get(i.typeId)?.superTypeId],
  icon:`${ASSET_API}/img/items/${i.iconId}.png`,setId:i.itemSetId > 0 ? i.itemSetId : undefined,
  stats:statsFrom(effectsForEquipmentStats(i.possibleEffects,slotForSuperType[typesById.get(i.typeId)?.superTypeId],effectsById)),conditionsText:i.criterions==='pk<2'?'Nombre de panoplies actives < 2':i.criterions ?? '',conditions:parseCondition(i.criterions),effects:rawEffects(i.possibleEffects,slotForSuperType[typesById.get(i.typeId)?.superTypeId]==='weapon'),
  weapon:normalizeWeaponMetadata(i,slotForSuperType[typesById.get(i.typeId)?.superTypeId]),
  passives:(i.possibleEffects ?? []).filter(effect => effect.effectId === 1175).map(effect => passivesById.get(effect.diceNum)).filter(Boolean),
  forgeable:i.enhanceable === true && i.etheral !== true,isLegendary:i.isLegendary === true,
  unsupportedEffects:(i.possibleEffects ?? []).filter(e=>passiveEffectIds.has(e.effectId)).map(e=>`Effet conditionnel ou modification de sort (${e.effectId})`),
}));
// Cache the whole equipment art catalogue: small transparent game icons, no remote dependency at runtime.
const itemIconMap = new Map();
await pooled([...new Set(items.map(i=>i.icon))], async url=>itemIconMap.set(url,await asset(url,`items/${url.split('/').at(-1)}`)), 6);
for(const item of items) item.icon=itemIconMap.get(item.icon);
const sets = setsRaw.map(s => ({id:s.id,name:fr(s.name),itemIds:items.filter(i=>i.setId===s.id).map(i=>i.id),bonuses:(s.effects ?? []).map((e,index)=>({count:index+1,stats:statsFrom(e)})).filter(b=>Object.keys(b.stats).length)})).filter(s=>s.itemIds.length);
const categoryNames = {1:'Autres',2:'Essentielles',3:'Utilitaires',4:'Dommages',5:'Résistances',6:'Combat'};
const spriteY={tx_lifePoints:917,tx_actionPoints:243,tx_movementPoints:50,tx_strength:430,tx_vitality:317,tx_wisdom:356,tx_chance:87,tx_agility:165,tx_intelligence:392,tx_damage:1154,tx_crit:587,tx_range:126,tx_damagesPercent:1106,tx_summonableCreaturesBoost:505,tx_dodgeAP:1062,tx_dodgeMP:1014,tx_initiative:203,tx_prospecting:277,tx_heal:964,tx_strengthRes:430,tx_intelligenceRes:392,tx_chanceRes:87,tx_agilityRes:165,tx_neutral:13,tx_neutralRes:13,tx_trapPercent:670,tx_trap:710,tx_escape:467,tx_tackle:543,tx_attackAP:1338,tx_attackMP:1338,tx_push:870,tx_pushReduction:830,tx_criticalDamage:1246,tx_criticalReduction:1198};
const defaults={actionPoints:12,movementPoints:6,range:6,criticalHit:50,vitality:3500,hitPoints:4000,strength:1000,intelligence:1000,chance:1000,agility:1000,wisdom:300,damagePercent:200,maxSummonedCreaturesBoost:3};
const statDefinitions = characteristics.filter(c=>c.id>=0 && fr(c.name)).map(c=>({key:c.keyword,id:c.id,name:((c.categoryId===4&&!/dommage|puissance|maitrise|érosion|renvoi/i.test(fr(c.name)))?'Dommages ':c.categoryId===5?'Résistance ':'')+fr(c.name),category:categoryNames[c.categoryId] ?? 'Autres',iconSpriteY:spriteY[c.asset],unit:c.keyword==='damagePercent'?'':/Percent|Multiplier|criticalHit/.test(c.keyword)?'%':'',defaultTarget:defaults[c.keyword]??(/Percent|Multiplier/.test(c.keyword)?20:50)}));
const serversRaw=await list('servers');
const fetchedAt = new Date().toISOString();
const source = localClient ? localClient.source : API;
const catalogue = {version,fetchedAt,source,classes,stats:statDefinitions,spells,items,sets,servers:serversRaw.filter(s=>s.gameTypeId===0||s.gameTypeId===4).map(s=>fr(s.name)),warnings:['Jets naturels maximaux comme base ; variantes exotiques PA/PM calculées par l’application.','Catalogue de sorts jouables : classes, variantes et sorts communs. Les sorts de monstres ne sont pas inclus.','Les prix de marché doivent être saisis par serveur. Aucun prix PNJ n’est utilisé.']};
Object.assign(catalogue,{combatSpells,combatStates,summons,combatTargets});
// The fallback overlay never overrides a native 3.7 import.
const patchReport=localClient?{applied:false,reason:'Native client catalogue; no balance overlay.',sourceVersion:version}:applyPatch37(catalogue);
if(localClient) {
  const limitations=JSON.parse(await readFile(resolve(ROOT,'data/simulation-limitations.json'),'utf8'));
  for(const key of ['items','spells'])for(const record of catalogue[key])if(limitations[key][record.id])record[key==='spells'?'balanceNotes':'dataWarnings']=limitations[key][record.id];
  catalogue.warnings.push('Données natives du client Ankama '+version+' ; les mécaniques non simulées restent signalées.');
}
await writeFile(resolve(OUTPUT_ROOT,'data/patch-3.7-report.json'),JSON.stringify(patchReport,null,2));
if (!skipAssets) await copyFile(resolve(ROOT,'app/assets/game-stat-icons.png'),resolve(ASSETS,'stat-icons.png')).catch(()=>{});
for (const [name,values] of Object.entries({classes,spells,items,sets})) {
  if (new Set(values.map(v=>v.id)).size!==values.length) throw new Error(`Identifiants dupliqués : ${name}`);
}
if (spells.some(s=>s.levels.length===0)) throw new Error('Sort sans rang : import incomplet');
if (items.some(i=>!i.slotType||Object.values(i.stats).some(v=>!Number.isFinite(v)))) throw new Error('Équipement invalide');
const catalogueText=JSON.stringify(catalogue);
await writeFile(resolve(OUTPUT_ROOT,'data/catalog.json'),catalogueText);
const punitive=spells.find(s=>s.id===32456);
if(punitive) await writeFile(resolve(OUTPUT_ROOT,'data/punitive-fixture.json'),JSON.stringify(punitive,null,2));
await writeFile(resolve(OUTPUT_ROOT,'data/effects-map.json'),JSON.stringify(effectDefinitions.map(e=>({id:e.id,stat:e.characteristic===0?undefined:charsById.get(e.characteristic)?.keyword,operator:e.characteristicOperator,bonusType:e.bonusType,element:elementNames[e.elementId],description:fr(e.description)}))));
await writeFile(resolve(OUTPUT_ROOT,'data/asset-sources.json'),JSON.stringify(assetManifest.sort((a,b)=>a.file.localeCompare(b.file)),null,2));
await writeFile(resolve(OUTPUT_ROOT,'data/source-manifest.json'),JSON.stringify({
  source,version:catalogue.version,sourceVersion:version,fetchedAt,unityVersion:localClient?.unityVersion,
  sourceFiles:localClient?.sourceFiles,languageFiles:localClient?.languageFiles,
  patch:patchReport.applied?{version:patchReport.version,source:patchReport.source,verifiedAt:patchReport.verifiedAt,changes:patchReport.changes.length,report:'patch-3.7-report.json'}:patchReport,
  catalogSha256:createHash('sha256').update(catalogueText).digest('hex'),
  counts:{classes:classes.length,characteristics:statDefinitions.length,spells:spells.length,spellLevels:levelsRaw.length,items:items.length,sets:sets.length,combatSpells:combatSpells.length,combatStates:combatStates.length,summons:summons.length,combatTargets:combatTargets.length,assets:assetManifest.length},
  endpointResources:['version','breeds','characteristics','effects','item-types','spell-variants','spell-types','spells','spell-levels','items','item-sets','servers',...(localClient?['spell-scripts','spell-states','monsters']:[])],
  licenseNote:'DOFUS et ses visuels appartiennent à Ankama. Les licences du code ne couvrent pas ces données et assets tiers.'
},null,2));
console.log(`Catalogue écrit : ${classes.length} classes, ${statDefinitions.length} caractéristiques, ${spells.length} sorts, ${items.length} objets, ${sets.length} panoplies.`);
