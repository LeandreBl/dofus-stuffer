import { getSpellLevel, calculateSpellCriticalChance } from './index.js';
import type { Catalog, CombatTarget, DamageLine, DamageRange, Element, RawEffect, Spell, SpellDamage, SpellLevel, SpellScenario, Stats } from './types.js';

export interface SpellCalculationContext { catalog?: Catalog; scenario?: SpellScenario; }
const elementStat: Record<Element, string> = { neutral: 'strength', earth: 'strength', fire: 'intelligence', water: 'chance', air: 'agility' };
export const SPELL_DAMAGE_ELEMENTS: Readonly<Record<number, Element>> = {
  82:'neutral',85:'water',86:'earth',87:'air',88:'fire',89:'neutral',
  91:'water',92:'earth',93:'air',94:'fire',95:'neutral',96:'water',97:'earth',98:'air',99:'fire',100:'neutral',144:'neutral',
  275:'water',276:'earth',277:'air',278:'fire',279:'neutral',
  1012:'neutral',1013:'air',1014:'water',1015:'fire',1016:'earth',
  1063:'earth',1064:'air',1065:'water',1066:'fire',1067:'air',1068:'water',1069:'fire',1070:'earth',1071:'neutral',
  1092:'neutral',1093:'air',1094:'fire',1095:'water',1096:'earth',
  1118:'neutral',1119:'air',1120:'fire',1121:'water',1122:'earth',
  1124:'neutral',1125:'air',1126:'fire',1127:'water',1128:'earth',
  1131:'air',1132:'water',1133:'fire',1134:'neutral',1135:'earth',1136:'air',1137:'water',1138:'fire',1139:'neutral',1140:'earth',
  1224:'neutral',1225:'air',1226:'fire',1227:'water',1228:'earth',
};
const references = new Set([792,1017,1019,1160,2160,2792,2794,2795,2960,400,401,402,1091,1165,2022]);
const summonEffects = new Set([181,1008,1011,405,2796]);
const runeSpells:Partial<Record<Element,number>>={earth:13690,fire:13665,water:13688,air:13689};
const buffEffects: Record<number,[string,number]> = {112:['allDamageBonus',1],118:['strength',1],119:['agility',1],123:['chance',1],126:['intelligence',1],138:['damagePercent',1],145:['allDamageBonus',-1],152:['chance',-1],154:['agility',-1],155:['intelligence',-1],157:['strength',-1],186:['damagePercent',-1],266:['chance',1],268:['agility',1],269:['intelligence',1],271:['strength',1],414:['pushDamageBonus',1],418:['criticalDamageBonus',1],419:['criticalDamageBonus',-1],1171:['dealtDamageMultiplier',1],1172:['dealtDamageMultiplier',-1],2800:['dealtDamageMultiplierMelee',1],2804:['dealtDamageMultiplierDistance',1],2812:['dealtDamageMultiplierSpells',1]};
const resistanceEffects: Record<number,Element> = {215:'earth',216:'water',217:'air',218:'fire',219:'neutral'};
// These actions have no outgoing HP damage. Visual script actions 3792/3793
// reference animation usages (confirmed in the native SpellScriptData bundle).
const utilityEffects = new Set([4,6,8,9,10,11,50,51,77,84,90,108,110,111,115,116,117,120,124,125,128,131,132,140,150,153,156,160,161,162,163,164,165,166,168,169,171,176,178,179,180,182,183,184,185,187,202,210,211,212,213,214,220,221,240,241,242,243,244,265,270,272,280,281,282,283,284,285,286,287,288,289,290,291,292,294,295,296,297,298,299,320,335,406,410,411,412,413,415,416,417,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,750,751,752,753,754,755,765,766,776,781,786,950,951,952,1009,1020,1031,1033,1036,1039,1041,1042,1045,1061,1075,1076,1078,1079,1080,1097,1099,1100,1101,1103,1104,1105,1106,1109,1144,1159,1181,1182,1183,1406,2018,2020,2023,2184,2802,2803,2805,2806,2844,2935,2971,2973,2998,2999,3000,3002,3792,3793]);
for(const id of [666,141,2027,2905,2906,1060,1040,314,782,2807,798,2017,2972])utilityEffects.add(id);
const finite = (value: number | undefined, fallback=0) => Number.isFinite(value) ? value! : fallback;
const zero = (): DamageRange => ({min:0,average:0,max:0});
const sum = (ranges: DamageRange[]): DamageRange => ranges.reduce((a,b)=>({min:a.min+b.min,average:a.average+b.average,max:a.max+b.max}),zero());
const clean = (text: string) => text.replace(/<[^>]*>/g,'').replace(/\{\{spell,\d+,\d+::([^}]+)\}\}/g,'$1').replace(/\[!\]\s*/g,'');
const graphIndexes = new WeakMap<Catalog, {spells:Map<number,Spell>;states:Map<number,NonNullable<Catalog['combatStates']>[number]>}>();
function graph(catalog?: Catalog) {
  if(!catalog)return {spells:new Map<number,Spell>(),states:new Map<number,NonNullable<Catalog['combatStates']>[number]>()};
  let index=graphIndexes.get(catalog);if(!index){index={spells:new Map([...(catalog.combatSpells ?? []),...catalog.spells].map(s=>[s.id,s])),states:new Map((catalog.combatStates ?? []).map(s=>[s.id,s]))};graphIndexes.set(catalog,index);}return index;
}
function bestElement(stats: Stats, worst=false): Element {
  const elements:Element[]=['earth','fire','water','air'];
  return elements.sort((a,b)=>(finite(stats[elementStat[b]])-finite(stats[elementStat[a]]) || finite(stats[b+'DamageBonus'])-finite(stats[a+'DamageBonus']))*(worst?-1:1))[0];
}
export function getSpellElements(spell: Spell, characterLevel=200, catalog?: Catalog): Element[] {
  const found=new Set<Element>(), seen=new Set<string>(), index=graph(catalog);
  function walk(s:Spell,rank?:number){const l=rank?s.levels.find(l=>l.grade===rank):getSpellLevel(s,characterLevel);if(!l||seen.has(`${s.id}:${l.id}`))return;seen.add(`${s.id}:${l.id}`);
    for(const e of [...l.effects,...l.criticalEffects]){
      if(SPELL_DAMAGE_ELEMENTS[e.effectId] && e.targetMask!=='C')found.add(SPELL_DAMAGE_ELEMENTS[e.effectId]);
      if([2822,2828,2832].includes(e.effectId))for(const el of ['earth','fire','water','air'] as Element[])found.add(el);
      if(references.has(e.effectId)){const child=index.spells.get(e.diceNum);if(child)walk(child,e.diceSide||undefined);}
      if(e.effectId===2023)for(const id of Object.values(runeSpells)){const child=index.spells.get(id);if(child)walk(child);}
      if(summonEffects.has(e.effectId))for(const id of catalog?.summons?.find(m=>m.id===e.diceNum)?.spells??[]){const child=index.spells.get(id);if(child)walk(child);}
    }}walk(spell);return ['earth','fire','water','air','neutral'].filter(e=>found.has(e as Element)) as Element[];
}

const fixedDamageEffects = new Set([82,144,1048,1063,1064,1065,1066,1067,1068,1069,1070,1071,
  1092,1093,1094,1095,1096,1118,1119,1120,1121,1122,1124,1125,1126,1127,1128,1223,1224,1225,1226,1227,1228]);
const casterLifeDamageEffects = new Set([85,86,87,88,89,275,276,277,278,279]);
const damageScalingStats = ['damagePercent','allDamageBonus','criticalDamageBonus',
  'dealtDamageMultiplier','dealtDamageMultiplierSpells','dealtDamageMultiplierMelee','dealtDamageMultiplierDistance'];

/** Eligible damage objectives depend on player stats, regardless of the currently
 * active states/zone. Pure boosts, fixed damage and target-life effects are excluded.
 * Summons qualify only when their damaging attacks inherit relevant player stats.
 */
export function hasStatScalingSpellDamage(spell: Spell, characterLevel=200, catalog?: Catalog): boolean {
  const index=graph(catalog), seen=new Set<string>();
  const uses=(keys:string[],inherited?:Set<string>)=>!inherited||keys.some(key=>inherited.has(key));
  function walk(s:Spell,rank?:number,inherited?:Set<string>,trap=false):boolean {
    const level=rank?s.levels.find(level=>level.grade===rank):getSpellLevel(s,characterLevel);
    if(!level)return false;
    const path=`${s.id}:${level.id}:${trap}:${inherited?[...inherited].sort().join(','):'player'}`;
    if(seen.has(path))return false;seen.add(path);
    for(const effect of [...level.effects,...level.criticalEffects]) {
      if(effect.clientOnly)continue;
      const id=effect.effectId, tokens=(effect.targetMask??'').split(',');
      const selfOnly=tokens.some(token=>token==='C'||token==='c')
        && !tokens.some(token=>/^[aAgGhHmMdDlLjJsSiI]$/.test(token));
      if(!selfOnly) {
        if(casterLifeDamageEffects.has(id)&&uses(['hitPoints','vitality'],inherited))return true;
        const element=SPELL_DAMAGE_ELEMENTS[id];
        if((element&&!fixedDamageEffects.has(id)&&!casterLifeDamageEffects.has(id))||[2822,2828,2832].includes(id)) {
          const keys=element?[elementStat[element],element+'DamageBonus']:['strength','intelligence','chance','agility','earthDamageBonus','fireDamageBonus','waterDamageBonus','airDamageBonus'];
          if(uses([...keys,...damageScalingStats,...(trap?['trapDamageBonus','trapDamageBonusPercent']:[])],inherited))return true;
        }
        if([5,783].includes(id)&&uses(['pushDamageBonus'],inherited))return true;
      }
      if(references.has(id)&&id!==2022) {
        const child=index.spells.get(effect.diceNum);
        if(child&&walk(child,effect.diceSide||1,inherited,trap||id===400))return true;
      }
      if(id===1026) {
        const child=index.spells.get(effect.value);
        if(child&&walk(child,child.levels.some(entry=>entry.grade===level.grade)?level.grade:undefined,inherited,trap))return true;
      }
      if(id===2023)for(const childId of Object.values(runeSpells)) {
        const child=index.spells.get(childId);if(child&&walk(child,undefined,inherited,trap))return true;
      }
      if(summonEffects.has(id)) {
        const summon=catalog?.summons?.find(summon=>summon.id===effect.diceNum);
        const grade=summon?.grades.find(grade=>grade.grade===(effect.diceSide||1))??summon?.grades[0];
        const inheritedKeys=new Set(Object.entries(grade?.inheritedStats??{}).filter(([key,value])=>value>0&&(!inherited||inherited.has(key))).map(([key])=>key));
        if(inheritedKeys.size)for(const childId of summon?.spells??[]) {
          const child=index.spells.get(childId);
          if(child&&walk(child,child.levels.some(level=>level.grade===(effect.diceSide||1))?effect.diceSide||1:undefined,inheritedKeys))return true;
        }
      }
    }
    return false;
  }
  return walk(spell);
}

/** One cast on one selected target. Triggered lines are a single occurrence unless
 * the user chooses another count; invocation attacks are never all added together.
 * Masks, effect order, ranks and zone falloff are retained from the native client.
 */
export function calculateNativeSpellDamage(spell:Spell, input:Stats, target:CombatTarget, characterLevel:number, context:SpellCalculationContext={}):SpellDamage {
  const level=getSpellLevel(spell,characterLevel), scenario=context.scenario ?? {}, index=graph(context.catalog);
  const warnings=new Set(spell.dataWarnings ?? []), parameters=new Set<string>(), options=new Map<string,NonNullable<SpellDamage['scenarioOptions']>[number]>(), attacks=new Map<number,NonNullable<SpellDamage['summonAttacks']>[number]>(), randomOptions=new Map<string,NonNullable<SpellDamage['randomOptions']>[number]>();
  const summonContexts=new Map<number,{stats:Stats;grade:number}>();
  const castSources=new Map<number,{id:number;name:string}>();
  let supported=warnings.size===0, hasIndirect=false, hasSummon=false;
  const fail=(message:string)=>{supported=false;warnings.add(message);};
  if(!level)return {spellId:spell.id,levelId:0,apCost:0,critChance:0,normal:zero(),critical:null,expected:0,perAp:0,lines:[],turns:[],supported:false,warnings:['Sort non disponible à ce niveau.']};
  function condition(mask:string,caster:Set<number>,states:Set<number>,includeSelf=false):boolean {
    const tokens=mask.split(',').filter(Boolean);let allowed=true;
    const positiveStates: Record<string,number[]>={}, positiveMonsters:Record<string,number[]>={};
    const casterOnly=includeSelf&&tokens.some(t=>t==='C'||t==='c');
    const anchor=includeSelf&&!tokens.some(t=>/^[ACcHMILJSD]$/.test(t));
    const kind=scenario.targetKind??'monster';
    const targetPattern=casterOnly?'caC':anchor?'agij':kind==='summon'?'AIJ':kind==='staticSummon'?'ASJ':kind==='character'?'AHL':kind==='companion'?'ADL':'AM';
    if(includeSelf&&tokens.includes('c')&&scenario.castSource)allowed=false;
    for(const token of tokens){
      const state=token.match(/^(\*)?([Ee])(\d+)$/);
      if(state){const role=state[1]||tokens.includes('C')?'caster':'target',id=Number(state[3]),name=clean(index.states.get(id)?.name || `État ${id}`);const key=`${role}:${id}`;
        options.set(key,{key,label:name,role,stateId:id});const active=(role==='caster'?caster:states).has(id);
        if(state[2]==='E'&&state[1])allowed &&=active;
        else if(state[2]==='E')(positiveStates[role]??=[]).push(id);else allowed &&=!active;
      }else if(/^\*?[vV]\d+$/.test(token)){
        const match=token.match(/^(\*)?([vV])(\d+)$/)!, own=Boolean(match[1])||casterOnly;
        parameters.add(own?'casterHpPercent':'targetHpPercent');
        const percent=own?finite(scenario.casterHpPercent,100):finite(scenario.targetHpPercent,scenario.targetMaxHp?100*finite(scenario.targetHp,scenario.targetMaxHp)/scenario.targetMaxHp:100);
        allowed &&=match[2]==='V'?percent<=Number(match[3]):percent>Number(match[3]);
      }else if(/^\*?[fF]\d+$/.test(token)){
        const match=token.match(/^(\*)?([fF])(\d+)$/)!, role=match[1]||anchor?'caster':'target',id=Number(match[3]);
        const creature=context.catalog?.combatTargets?.find(m=>m.id===id);
        if(role==='caster'&&match[2]==='F'&&creature)castSources.set(id,creature);
        else if(role==='target'&&creature)parameters.add('targetMonsterId');
        if(match[2]==='F')(positiveMonsters[role]??=[]).push(id);
        else allowed &&=(role==='caster'?scenario.castSource:scenario.targetMonsterId)!==id;
      }else if(/^[bB]\d+$/.test(token)){
        parameters.add('targetClassId');const same=kind==='character'&&scenario.targetClassId===Number(token.slice(1));
        allowed &&=token[0]==='B'?same:!same;
      }else if(['pb','PB','r','R','K','T','O','U'].includes(token)){
        const keys:Record<string,[string,string]>={pb:['shield','La cible a du bouclier'],PB:['shield','La cible a du bouclier'],r:['portal','Sort projeté dans un portail'],R:['portal','Sort projeté dans un portail'],K:['carried','La cible est portée'],T:['telefrag','Ce lancer génère un Téléfrag'],O:['triggerCaster','La cible déclenche cet effet'],U:['newSummon','Invocation créée par ce lancer']};
        const [key,label]=keys[token];options.set(key,{key,label,role:'condition'});
        const enabled=scenario.conditions?.includes(key)??false;allowed &&=['pb','r'].includes(token)?!enabled:enabled;
      }else if(/\d/.test(token)){
        fail(`Condition native inconnue : ${token}.`);allowed=false;
      }
    }
    for(const [role,ids]of Object.entries(positiveStates))allowed &&=ids.some(id=>(role==='caster'?caster:states).has(id));
    for(const [role,ids]of Object.entries(positiveMonsters))allowed &&=ids.includes((role==='target'?scenario.targetMonsterId:scenario.castSource)??-1);
    // Basic target masks are an OR: upper-case enemy / lower-case ally.
    // H/L are players, M monsters, I/J mobile summons, S/J static summons.
    const ordinary=tokens.filter(t=>/^[aAcCgGhHmMdDlLjJsSiI]$/.test(t));
    if(ordinary.some(t=>/^[HhMmDdLlJjSsIi]$/.test(t)))parameters.add('targetKind');
    if(ordinary.length&&!ordinary.some(t=>targetPattern.includes(t)))allowed=false;
    if(!includeSelf&&scenario.conditions?.includes('carried')&&!tokens.includes('K'))allowed=false;
    return allowed;
  }
  const casterHp=()=>Math.floor(Math.max(0,finite(input.hitPoints,1050))*Math.max(0,Math.min(100,finite(scenario.casterHpPercent,100)))/100);
  let effectiveDistance=Math.max(0,finite(scenario.zoneDistance)),nearestActiveZone=Infinity;
  const rootHasEnemyCast=level.effects.some(e=>!e.clientOnly&&!e.targetMask?.includes('F50000')&&e.targetMask?.split(',').some(t=>['A','H','M','I','J','D','L'].includes(t))&&(references.has(e.effectId)||Boolean(SPELL_DAMAGE_ELEMENTS[e.effectId])));
  const zoneContains=(e:RawEffect)=>{
    const zone=e.zone;if(!zone)return true;
    const distance=effectiveDistance;
    if(zone.shape===79){nearestActiveZone=Math.min(nearestActiveZone,zone.radius);parameters.add('zoneDistance');return distance===zone.radius;}
    if(zone.shape===80){nearestActiveZone=0;return distance===0;}
    if([67,81,88].includes(zone.shape)){const minimum=zone.minRadius<63?zone.minRadius:0;nearestActiveZone=Math.min(nearestActiveZone,minimum);if(zone.radius)parameters.add('zoneDistance');return distance<=zone.radius&&distance>=minimum;}
    return true;
  };
  function branch(critical:boolean,baseBonus=0):DamageLine[] {
    const stats={...input}, resist={...target.percent}, caster=new Set(scenario.casterStates), states=new Set(scenario.targetStates), lines:DamageLine[]=[];
    if(spell.classIds.includes(12)&&!caster.has(498)&&!caster.has(3531))caster.add(3531);
    if(spell.classIds.includes(20)&&!caster.has(3360)&&!caster.has(3361))caster.add(3360);
    let receivedMultiplier=1, reducedDamage=0;
    const appliedStateEffects=[...caster].flatMap(id=>index.states.get(id)?.effects.filter(e=>e.visibleInTooltip) ?? []);
    const baseBonuses=new Map<number,number>(), randomDraws=new Map<string,number>();
    for(const e of appliedStateEffects){if(e.effectId===293)baseBonuses.set(e.diceNum,(baseBonuses.get(e.diceNum)??0)+e.value);const mapping=buffEffects[e.effectId];if(mapping)stats[mapping[0]]=finite(stats[mapping[0]])+finite(e.diceNum||e.value)*mapping[1];}
    // State effects describe existing bonuses; native state links also encode
    // derived colour/form flags used by dependent damage lines.
    for(const id of [...caster])for(const e of index.states.get(id)?.effects ?? [])if(e.effectId===950)caster.add(e.value);
    function range(e:RawEffect,element:Element,isCrit:boolean,trap:boolean,source:number):DamageRange {
      const poisonResource=e.effectId>=1131&&e.effectId<=1140;
      const low=Math.max(0,poisonResource?e.diceSide:e.diceNum||e.value), high=poisonResource?low:Math.max(low,e.diceSide||low), bonus=baseBonus+(baseBonuses.get(source)??0)+finite(scenario.baseDamageBonus);
      let scale=1, flatMode=false;
      if([82,144,1063,1064,1065,1066].includes(e.effectId)){flatMode=true;}
      if([85,86,87,88,89].includes(e.effectId)){parameters.add('casterHpPercent');scale=casterHp()/100;flatMode=true;}
      if([275,276,277,278,279].includes(e.effectId)){parameters.add('casterHpPercent');scale=(finite(input.hitPoints,1050)-casterHp())/100;flatMode=true;}
      if(e.effectId>=1092&&e.effectId<=1096){parameters.add('targetErodedHp');scale=finite(scenario.targetErodedHp)/100;flatMode=true;}
      if(e.effectId>=1118&&e.effectId<=1122){parameters.add('casterErodedHp');scale=finite(scenario.casterErodedHp)/100;flatMode=true;}
      if(e.effectId>=1067&&e.effectId<=1071){parameters.add('targetHp');scale=finite(scenario.targetHp,4000)/100;flatMode=true;}
      if(e.effectId>=1124&&e.effectId<=1128){parameters.add('initialReceivedDamage');scale=finite(scenario.initialReceivedDamage)/100;flatMode=true;}
      if(e.effectId>=1012&&e.effectId<=1016){parameters.add('remainingMp');scale=finite(scenario.remainingMp,3);}
      if(poisonResource){const resource=e.effectId<=1135?'usedAp':'usedMp';parameters.add(resource);scale=Math.floor(finite(scenario[resource],3)/Math.max(1,e.diceNum));}
      if(e.effectId>=1223&&e.effectId<=1228){parameters.add('receivedDamage');scale=finite(scenario.receivedDamage)/100;flatMode=true;}
      if(e.effectId===1048){parameters.add('targetHp');scale=finite(scenario.targetHp,4000)/100;flatMode=true;}
      const zoneDistance=effectiveDistance;if(e.zone?.falloff&&e.zone.shape!==80&&e.zone.radius)parameters.add('zoneDistance');
      const nonDecreasingZone=e.zone&&[65,97,90,73,79,59,32,80].includes(e.zone.shape);
      const zoneSteps=Math.max(0,zoneDistance-(e.zone?.minRadius&&e.zone.minRadius<63?e.zone.minRadius:0));
      const zoneFactor=nonDecreasingZone?1:Math.max(0,1-(e.zone?.falloff ?? 0)*Math.min(zoneSteps,e.zone?.maxFalloff ?? 0)/100);
      const amount=(roll:number)=>{
        const stat=Math.max(0,finite(stats[elementStat[element]])+finite(stats.damagePercent)+(trap?finite(stats.trapDamageBonusPercent):0));
        const flat=finite(stats.allDamageBonus)+finite(stats[element+'DamageBonus'])+(isCrit?finite(stats.criticalDamageBonus):0)+(trap?finite(stats.trapDamageBonus):0);
        const raw=flatMode?Math.floor(roll*scale):Math.floor((roll+bonus)*scale*(100+stat)/100)+flat;
        const fixed=finite(target.flat[element])+(isCrit?finite(target.criticalResistance):0)+reducedDamage;
        const after=Math.floor(Math.max(0,raw-fixed)*Math.max(0,1-finite(resist[element])/100));
        const final=flatMode?1:Math.max(0,1+finite(stats.dealtDamageMultiplierSpells)/100)*Math.max(0,1+finite(stats[target.distance==='melee'?'dealtDamageMultiplierMelee':'dealtDamageMultiplierDistance'])/100)*Math.max(0,1+finite(stats.dealtDamageMultiplier)/100);
        return Math.max(0,Math.floor(after*final*receivedMultiplier*zoneFactor));
      };
      if(high-low>10000){fail('Plage native de dégâts trop grande.');return zero();}
      let total=0;for(let roll=low;roll<=high;roll++)total+=amount(roll);
      return {min:amount(low),average:total/(high-low+1),max:amount(high)};
    }
    const visited=new Set<string>();
    function walk(s:Spell,l:SpellLevel,trap=false,inheritedDelay=0,trigger='',depth=0,isCrit=critical):void {
      const path=`${s.id}:${l.grade}`;
      if(depth>16 || visited.has(path))return;visited.add(path);
      const effects=(isCrit&&l.criticalEffects.length?l.criticalEffects:l.effects).filter(e=>!e.clientOnly);
      const masksCaster=new Set(caster),masksTarget=new Set(states);
      const randomEffects=effects.filter(e=>finite(e.random)>0);
      let selectedRandomGroup:number|undefined;
      if(randomEffects.length){
        const key=`random:${s.id}:${l.grade}`,groups=[...new Set(randomEffects.map(e=>finite(e.group)))],draw=randomDraws.get(key)??0;
        const existing=randomOptions.get(key);randomOptions.set(key,{key,label:clean(s.name),draws:Math.max(existing?.draws??0,draw+1),choices:groups.map(id=>{const e=randomEffects.find(e=>finite(e.group)===id)!,element=SPELL_DAMAGE_ELEMENTS[e.effectId];const name=element?({earth:'Terre',fire:'Feu',water:'Eau',air:'Air',neutral:'Neutre'})[element]:undefined;return {id,label:references.has(e.effectId)?clean(index.spells.get(e.diceNum)?.name??`Issue ${id}`):name?`${name} · ${e.diceNum}${e.diceSide?` à ${e.diceSide}`:''}`:clean((e.description??`Issue ${id}`).replaceAll('#1',String(e.diceNum)).replaceAll('#2',String(e.diceSide||e.diceNum)))};})});
        selectedRandomGroup=scenario.randomChoices?.[key]?.[draw] ?? groups[0];randomDraws.set(key,draw+1);
      }
      for(const e of [...effects].sort((a,b)=>finite(a.order)-finite(b.order))){
        if(finite(e.random)>0&&finite(e.group)!==selectedRandomGroup)continue;
        const mask=e.targetMask ?? '', active=condition(mask,masksCaster,masksTarget), self=mask.split(',').some(t=>t==='C'||t==='c') && condition(mask,masksCaster,masksTarget,true);
        const delay=inheritedDelay+Math.max(0,e.delay ?? 0), periodic=(e.triggers && e.triggers!=='I')?e.triggers:trigger;
        if(s.id===spell.id&&rootHasEnemyCast&&level!.effects.some(e=>e.targetMask==='c')){
          options.set('selfCast',{key:'selfCast',label:'Sort lancé sur ton personnage',role:'condition'});
          const selfCast=scenario.conditions?.includes('selfCast')??false, tokens=mask.split(',');
          if(mask==='c'&&!selfCast||selfCast&&!tokens.includes('c')&&!tokens.includes('C'))continue;
        }
        if(references.has(e.effectId)) {
          // A self-targeted intermediary may itself hit enemies. Follow it even
          // when the immediate action has no enemy target.
          const conditionOk=condition(mask,masksCaster,masksTarget,true);if(!conditionOk)continue;
          // Runes are placed objects; the creation spell is not an attack.
          if(e.effectId===2022)continue;
          const child=index.spells.get(e.diceNum), childLevel=child?.levels.find(l=>l.grade===(e.diceSide||1));
          if(!childLevel && child?.levels.every(l=>l.effects.every(e=>e.effectId===666)))continue;
          if(!child || !childLevel){fail(`Sous-sort natif ${e.diceNum}, rang ${e.diceSide||1}, absent du catalogue.`);continue;}
          const isTrap=trap||e.effectId===400, glyph=[401,402,1091,1165].includes(e.effectId);if(isTrap||glyph||periodic)hasIndirect=true;
          walk(child,childLevel,isTrap,delay,periodic||(isTrap?'PIÈGE':glyph?'GLYPHE':''),depth+1,isTrap||glyph?false:isCrit);continue;
        }
        if(summonEffects.has(e.effectId)) {
          hasSummon=true;const summon=context.catalog?.summons?.find(m=>m.id===e.diceNum);
          if(!summon){fail(`Invocation native ${e.diceNum} absente du catalogue.`);continue;}
          const grade=summon.grades.find(g=>g.grade===(e.diceSide||1))??summon.grades[0];
          const summonStats={...grade?.stats};for(const [key,percent]of Object.entries(grade?.inheritedStats??{}))summonStats[key]=finite(summonStats[key])+Math.floor(finite(input[key])*percent/100);
          for(const id of summon.spells){const attack=index.spells.get(id);if(attack && getSpellElements(attack,characterLevel,context.catalog).length){attacks.set(id,{id,name:clean(attack.name),summon:summon.name});summonContexts.set(id,{stats:summonStats,grade:e.diceSide||1});}}
          continue;
        }
        if(e.effectId===2023){
          parameters.add('runes');if(!active)continue;hasIndirect=true;
          for(const [element,id]of Object.entries(runeSpells)){
            const count=Math.max(0,Math.min(20,finite(scenario.runes?.[element as Element]))),rune=index.spells.get(id),rank=rune&&getSpellLevel(rune,characterLevel);
            if(count&&(!rune||!rank)){fail(`Rune native ${id} absente du catalogue.`);continue;}
            for(let occurrence=0;occurrence<count;occurrence++)walk(rune!,rank!,false,delay,'RUNE',depth+1,false);
          }
          continue;
        }
        if(e.effectId===1026){hasIndirect=true;const child=index.spells.get(e.value);if(child&&active){const childLevel=child.levels.find(l=>l.grade===level!.grade)??getSpellLevel(child,characterLevel);if(childLevel)walk(child,childLevel,trap,delay,'GLYPHE',depth+1,false);}continue;}
        if([950,951].includes(e.effectId)&&!periodic&&!delay){const set=self?caster:active?states:undefined;if(set){if(e.effectId===950)set.add(e.value);else set.delete(e.value);}continue;}
        const damageElement=SPELL_DAMAGE_ELEMENTS[e.effectId] ?? ([2822,2828,2832].includes(e.effectId)?bestElement(stats,e.effectId===2832):e.effectId===1223?(parameters.add('receivedElement'),scenario.receivedElement??'neutral'):e.effectId===1048?'neutral':undefined);
        if(damageElement){
          // Collect parameters for inactive branches as well, so they can be configured.
          if(!active||!zoneContains(e))continue;
          const result=range(e,damageElement,isCrit,trap,s.id), count=periodic?Math.max(0,Math.min(20,finite(scenario.triggerCount,1))):1;
          if(periodic){hasIndirect=true;parameters.add('triggerCount');}
          lines.push({element:damageElement,baseMin:e.diceNum||e.value,baseMax:e.diceSide||e.diceNum||e.value,normal:{min:result.min*count,average:result.average*count,max:result.max*count},critical:null,delay,label:clean(s.name),trigger:periodic||undefined,duration:e.triggerDuration||e.duration,sourceSpellId:s.id,kind:'elemental'});continue;
        }
        if(e.effectId===5||e.effectId===1041||e.effectId===783){
          if(!active || e.effectId===1041)continue;parameters.add('blockedPushCells');parameters.add('pushResistance');
          const cells=Math.max(0,Math.min(e.diceNum||63,finite(scenario.blockedPushCells))), value=Math.max(0,Math.floor((characterLevel/2+32+finite(stats.pushDamageBonus)-finite(scenario.pushResistance))*cells/4));
          if(cells)lines.push({element:'neutral',baseMin:cells,baseMax:cells,normal:{min:value,average:value,max:value},critical:null,delay,label:'Poussée',sourceSpellId:s.id,kind:'push'});continue;
        }
        if(e.effectId===141&&active){parameters.add('targetHp');const value=Math.max(0,finite(scenario.targetHp,4000));lines.push({element:'neutral',baseMin:0,baseMax:0,normal:{min:value,average:value,max:value},critical:null,delay,label:'Exécution de la cible',sourceSpellId:s.id,kind:'life'});continue;}
        if(e.effectId===293){if(self&&!periodic&&!delay)baseBonuses.set(e.diceNum,(baseBonuses.get(e.diceNum)??0)+e.value);parameters.add('baseDamageBonus');continue;}
        if(buffEffects[e.effectId]){if((self||([266,268,269,271].includes(e.effectId)&&active))&&!periodic&&!delay){const [key,sign]=buffEffects[e.effectId];stats[key]=finite(stats[key])+finite(e.diceNum||e.value)*sign;}continue;}
        if(resistanceEffects[e.effectId]){if(active&&!periodic&&!delay){const element=resistanceEffects[e.effectId];resist[element]=finite(resist[element])-e.diceNum;}continue;}
        if(e.effectId===1163){if(active&&!periodic&&!delay)receivedMultiplier*=e.diceNum/100;continue;}
        if(e.effectId===265){if(active&&!periodic&&!delay)reducedDamage+=e.diceNum;continue;}
        if(!utilityEffects.has(e.effectId))fail(`Action native ${e.effectId} : ${e.description || 'effet non identifié'}.`);
      }
      visited.delete(path);
    }
    walk(spell,level!);
    return lines;
  }
  let normalLines=branch(false);
  if(scenario.zoneDistance===undefined&&!normalLines.length&&Number.isFinite(nearestActiveZone)&&nearestActiveZone>0){effectiveDistance=nearestActiveZone;normalLines=branch(false);}
  const criticalLines=level.criticalHitProbability>0?branch(true):[];
  if(scenario.summonSpellId&&attacks.has(scenario.summonSpellId)){
    const selected=index.spells.get(scenario.summonSpellId)!, invocation=summonContexts.get(selected.id)!;
    const selectedLevel=selected.levels.find(l=>l.grade===invocation.grade)??getSpellLevel(selected,characterLevel);
    const result=calculateNativeSpellDamage({...selected,levels:selectedLevel?[selectedLevel]:[]},invocation.stats,target,characterLevel,{...context,scenario:{...scenario,summonSpellId:undefined}});
    return {...result,spellId:spell.id,damageKind:'summon',summonAttacks:[...attacks.values()],castSources:[...castSources.values()],warnings:[...warnings,...result.warnings]};
  }
  const normal=sum(normalLines.map(l=>l.normal)), critical=level.criticalHitProbability>0?sum(criticalLines.map(l=>l.normal)):null;
  const lines=normalLines.map((line,i)=>({...line,critical:criticalLines[i]?.normal ?? null}));
  for(let i=normalLines.length;i<criticalLines.length;i++)lines.push({...criticalLines[i],normal:zero(),critical:criticalLines[i].normal});
  const charges=level.effects.filter(e=>e.effectId===293&&e.diceNum===spell.id&&(e.delay??0)>0);
  const horizon=Math.min(12,Math.max(3,level.minCastInterval+1,...charges.map(e=>(e.delay??0)+Math.max(1,e.duration??1))));
  const turns=Array.from({length:horizon+1},(_,turn)=>{
    const bonus=turn?charges.filter(e=>turn>=(e.delay??0)&&turn<(e.delay??0)+Math.max(1,e.duration??1)).reduce((a,b)=>a+b.value,0):0;
    return {turn,bonus,normal:bonus?sum(branch(false,bonus).map(l=>l.normal)):normal,critical:critical&&bonus?sum(branch(true,bonus).map(l=>l.normal)):critical,available:turn===0||turn>=Math.max(1,level.minCastInterval)};
  });
  if(charges.length)warnings.add('Relances après un lancement initial, sans lancer intermédiaire.');
  if(hasIndirect)warnings.add('Dégâts pour le nombre de déclenchements choisi, sur une cible.');
  const critChance=calculateSpellCriticalChance(spell,input,characterLevel)??0,expected=normal.average*(1-critChance/100)+(critical?.average??normal.average)*critChance/100;
  return {spellId:spell.id,levelId:level.id,apCost:level.apCost,critChance,normal,critical,expected,perAp:level.apCost?expected/level.apCost:0,lines,turns,supported,warnings:[...warnings],scenarioOptions:[...options.values()],parameters:[...parameters],summonAttacks:[...attacks.values()],castSources:[...castSources.values()],zoneDistance:effectiveDistance,randomOptions:[...randomOptions.values()],damageKind:hasSummon?'summon':hasIndirect?'triggered':lines.length?'direct':'support'};
}
