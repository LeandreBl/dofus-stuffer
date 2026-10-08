import { useState } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { getSpellLevel, type Spell, type SpellDamage, type SpellScenario } from '@dofus/shared';

const controls: Record<string,{label:string;presets:number[];initial:number;max:number}>={
  casterHpPercent:{label:'Tes PV restants (%)',presets:[25,50,75,100],initial:100,max:100},
  casterErodedHp:{label:'Tes PV érodés',presets:[0,500,1000,2000],initial:0,max:1000000},
  targetErodedHp:{label:'PV érodés de la cible',presets:[0,500,1000,2000],initial:0,max:1000000},
  targetHp:{label:'PV actuels de la cible',presets:[1000,4000,10000],initial:4000,max:1000000},
  targetHpPercent:{label:'PV restants de la cible (%)',presets:[25,50,75,100],initial:100,max:100},
  remainingMp:{label:'PM restants de la cible',presets:[0,3,6],initial:3,max:30},
  usedAp:{label:'PA dépensés par la cible',presets:[0,3,6,9,12],initial:3,max:100},
  usedMp:{label:'PM dépensés par la cible',presets:[0,1,3,6],initial:3,max:100},
  initialReceivedDamage:{label:'Dégâts initiaux subis avant réduction',presets:[0,500,1000,2000],initial:0,max:1000000},
  blockedPushCells:{label:'Cases de poussée bloquées',presets:[0,1,2,3,4],initial:0,max:63},
  pushResistance:{label:'Résistance poussée de la cible',presets:[0,50,100,200],initial:0,max:100000},
  zoneDistance:{label:'Cases depuis le centre de la zone',presets:[0,1,2,3,4],initial:0,max:63},
  triggerCount:{label:'Nombre de déclenchements',presets:[0,1,2,3,4],initial:1,max:20},
  baseDamageBonus:{label:'Bonus de base déjà accumulé',presets:[0,5,10,15],initial:0,max:10000},
  receivedDamage:{label:'Dégâts subis avant le renvoi',presets:[0,500,1000,2000],initial:0,max:1000000},
};

export function SpellScenarioPanel({spell,damage,value,onChange}:{spell:Spell;damage:SpellDamage;value:SpellScenario;onChange:(value:SpellScenario)=>void}){
  const [search,setSearch]=useState('');
  const [open,setOpen]=useState(false);
  // Base damage the spell adds to itself per cast (e.g. 36 for Flèche d'Expiation), delayed or not.
  const level=getSpellLevel(spell), bonus=level?.effects.find(e=>e.effectId===293&&e.diceNum===spell.id&&e.value>0)?.value;
  // At most one cast per turn: the recast table already shows the accumulation turn by turn.
  const oncePerTurn=!!bonus&&(level?.maxCastPerTurn===1||!!level?.minCastInterval);
  const options=damage.scenarioOptions??[], parameters=(damage.parameters??[]).filter(key=>!['targetMonsterId','targetKind','targetClassId'].includes(key)&&!(oncePerTurn&&key==='baseDamageBonus')), random=damage.randomOptions??[];
  const patch=(updates:Partial<SpellScenario>)=>onChange({...value,...updates});
  const enabledOption=(option:typeof options[number])=>option.role==='condition'?Boolean(value.conditions?.includes(option.key)):Boolean((option.role==='caster'?value.casterStates:value.targetStates)?.includes(option.stateId!)||(option.role==='caster'&&option.stateId===3531&&spell.classIds.includes(12)&&!value.casterStates?.includes(498))||(option.role==='caster'&&option.stateId===3360&&spell.classIds.includes(20)&&!value.casterStates?.includes(3361)));
  if(!options.length&&!parameters.length&&!random.length&&!damage.summonAttacks?.length&&!damage.castSources?.length)return null;
  const toggle=(option:typeof options[number])=>{
    if(option.role==='condition'){const selected=value.conditions??[];patch({conditions:selected.includes(option.key)?selected.filter(key=>key!==option.key):[...selected,option.key]});return;}
    const key=option.role==='caster'?'casterStates':'targetStates', selected=value[key]??[],id=option.stateId!;
    const group=[3531,498].includes(id)?[3531,498]:[3360,3361].includes(id)?[3360,3361]:[];
    const exclusive=selected.filter(n=>!group.includes(n));
    patch({[key]:selected.includes(id)?selected.filter(n=>n!==id):[...exclusive,id]});
  };
  return <section className="spell-scenario" aria-label="Situation du sort">
    <div className="spell-scenario-heading"><h3><button className="panel-fold" aria-expanded={open} onClick={()=>setOpen(!open)}><SlidersHorizontal size={15}/> Situation du sort <ChevronDown size={14}/></button></h3><button className="button ghost small" onClick={()=>onChange({})}><RotateCcw size={12}/> Réinitialiser</button></div>
    {open&&<>
    <p>Une cible, avec les états et déclenchements choisis. Cette situation est conservée quand tu ajoutes un objectif.</p>
    {damage.summonAttacks?.length ? <label className="field">Attaque de l’invocation<select value={value.summonSpellId??''} onChange={e=>patch({summonSpellId:Number(e.target.value)||undefined})}><option value="">Lancement du sort uniquement</option>{damage.summonAttacks.map(attack=><option key={attack.id} value={attack.id}>{attack.summon} · {attack.name}</option>)}</select></label>:null}
    {damage.castSources?.length ? <label className="field">Source du sort<select value={value.castSource??''} onChange={e=>patch({castSource:Number(e.target.value)||undefined})}><option value="">Ton personnage</option>{damage.castSources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label>:null}
    {parameters.includes('receivedElement')&&<label className="field">Élément des dégâts renvoyés<select value={value.receivedElement??'neutral'} onChange={e=>patch({receivedElement:e.target.value as SpellScenario['receivedElement']})}>{(['neutral','earth','fire','water','air'] as const).map(element=><option key={element} value={element}>{({neutral:'Neutre',earth:'Terre',fire:'Feu',water:'Eau',air:'Air'})[element]}</option>)}</select></label>}
    {parameters.includes('runes')&&<div className="spell-scenario-parameters">{(['earth','fire','water','air'] as const).map(element=><div className="scenario-parameter" key={element}><label>Runes {({earth:'Terre',fire:'Feu',water:'Eau',air:'Air'})[element]} déclenchées</label><div className="scenario-presets">{[0,1,2,3,5,10].map(n=><button key={n} className={(value.runes?.[element]??0)===n?'active':''} aria-pressed={(value.runes?.[element]??0)===n} onClick={()=>patch({runes:{...value.runes,[element]:n}})}>{n}</button>)}<input aria-label={`Runes ${element} déclenchées`} type="number" min={0} max={20} value={value.runes?.[element]??0} onChange={e=>patch({runes:{...value.runes,[element]:Math.max(0,Math.min(20,Number(e.target.value)))}})}/></div></div>)}</div>}
    <div className="spell-scenario-parameters">{parameters.filter(key=>controls[key]).map(key=>{
      // Accumulated base damage is entered as a cast count; the scenario still stores the damage (count × bonus).
      const perCast=key==='baseDamageBonus'&&bonus?bonus:1;
      const max=key==='blockedPushCells'?damage.pushDistance??controls[key].max:perCast>1?50:controls[key].max;
      const definition=perCast>1?{label:`Nombre de relances déjà accumulées (+${perCast} chacune)`,presets:[0,1,2,3,4,5,6],initial:0,max}:{...controls[key],max};
      const stored=((value as Record<string,unknown>)[key]??(key==='zoneDistance'?damage.zoneDistance:undefined)) as number|undefined;
      const current=stored===undefined?undefined:Math.min(Math.round(stored/perCast),max);
      const presets=definition.presets.filter(n=>n<=max);
      const change=(n:number)=>{
        const updates:Partial<SpellScenario>={[key]:Math.max(0,Math.min(definition.max,n))*perCast};
        if(key==='baseDamageBonus'&&n>0){const required=[...(level?.statesCriterion??'').matchAll(/HS=(\d+)/g)].map(m=>Number(m[1]));if(required.length)updates.casterStates=[...new Set([...(value.casterStates??[]),...required])];}
        patch(updates);
      };
      return <div className="scenario-parameter" key={key}><label htmlFor={`scenario-${spell.id}-${key}`}>{definition.label}</label><div className="scenario-presets">{presets.map(n=><button key={n} className={n===(current??definition.initial)?'active':''} aria-pressed={n===(current??definition.initial)} onClick={()=>change(n)}>{n}</button>)}<input id={`scenario-${spell.id}-${key}`} aria-label={definition.label} type="number" min={0} max={definition.max} value={current??definition.initial} onChange={e=>change(Number(e.target.value))}/></div></div>;
    })}</div>
    {random.map(entry=><div key={entry.key} className="scenario-random"><h4>{entry.label} · issues du tirage</h4>{Array.from({length:Math.min(20,entry.draws)},(_,draw)=><label className="field" key={draw}>Tirage {draw+1}<select value={value.randomChoices?.[entry.key]?.[draw]??entry.choices[0]?.id} onChange={e=>{const choices=Array.from({length:entry.draws},(_,i)=>value.randomChoices?.[entry.key]?.[i]??entry.choices[0].id);choices[draw]=Number(e.target.value);patch({randomChoices:{...value.randomChoices,[entry.key]:choices}});}}>{entry.choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>)}</div>)}
    {!!options.length&&<details className="scenario-state-details"><summary>États du lanceur et de la cible <span>{options.filter(enabledOption).length} actifs</span></summary>
      {options.length>12&&<input className="scenario-search" placeholder="Rechercher un état…" aria-label="Rechercher un état" value={search} onChange={e=>setSearch(e.target.value)}/>}
      {(['caster','target','condition'] as const).map(role=>{const entries=options.filter(o=>o.role===role&&o.label.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));return entries.length?<div key={role}><h4>{role==='caster'?'Lanceur':role==='target'?'Cible':'Conditions de la cible'}</h4><div className="scenario-state-list">{entries.map(option=>{const enabled=enabledOption(option);return <button key={option.key} aria-pressed={enabled} className={enabled?'active':''} onClick={()=>toggle(option)}>{option.label}</button>;})}</div></div>:null;})}
    </details>}
    </>}
  </section>;
}
