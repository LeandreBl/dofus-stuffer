import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpellDamage, calculateNativeSpellDamage, defaultTarget, getSpellElements, getSpellLevel, evaluateBuild, defaultCharacter } from '../packages/shared/dist/index.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const spell=name=>catalog.spells.find(s=>s.name===name);
const calculate=(s,stats={},scenario={})=>calculateSpellDamage(s,stats,defaultTarget(),200,{catalog,scenario});
const effect=(effectId,diceNum,extra={})=>({effectId,diceNum,diceSide:0,value:0,order:0,targetMask:'A',triggers:'I',...extra});
const fixture=effects=>({id:1,name:'Fixture',description:'',classIds:[9],icon:'',levels:[{id:1,grade:1,minPlayerLevel:1,apCost:4,minRange:1,range:10,rangeCanBeBoosted:true,criticalHitProbability:0,maxCastPerTurn:1,maxCastPerTarget:1,minCastInterval:0,effects,criticalEffects:[]}]});

test('every playable rank has a finite native calculation, with exact missing dependencies reported',()=>{
  const failures=[];
  for(const s of catalog.spells)for(const l of s.levels){
    const result=calculateNativeSpellDamage({...s,levels:[l]},{hitPoints:4000},defaultTarget(),200,{catalog});
    if(!result.supported)failures.push(`${s.name} ${l.grade}: ${result.warnings.join(', ')}`);
    assert.ok(Number.isFinite(result.normal.average),s.name);
  }
  assert.deepEqual(failures,[]);
  const broken=fixture([effect(400,999999)]);
  assert.equal(calculate(broken).supported,false);
});

test('native support and visual actions do not invalidate damage; support spells deal zero HP damage',()=>{
  const direct=fixture([effect(97,10),effect(3793,0),effect(666,0),effect(1079,2)]);
  assert.equal(calculate(direct).normal.min,10);
  assert.equal(calculate(direct).supported,true);
  const result=calculate(spell('Puissance'));
  assert.equal(result.normal.max,0);
  assert.equal(result.supported,true);
});

test('the best elemental characteristic chooses the element before target resistances',()=>{
  const s=fixture([effect(2822,10)]);
  const result=calculate(s,{strength:100,intelligence:200,fireDamageBonus:20});
  assert.equal(result.lines[0].element,'fire');
  assert.equal(result.normal.min,50);
});

test('traps resolve their exact dependency rank and use trap power and damage',()=>{
  const s=spell('Piège Sournois'),stats={intelligence:100,trapDamageBonusPercent:100,trapDamageBonus:20};
  const result=calculate(s,stats);
  assert.ok(result.supported);
  assert.ok(result.lines.length);
  assert.equal(result.lines[0].element,'fire');
  assert.equal(result.normal.min,Math.floor(result.lines[0].baseMin*3)+20);
  assert.ok(getSpellElements(s,200,catalog).includes('fire'));
});

test('conditional state branches do not add incompatible damage lines',()=>{
  const s=fixture([effect(97,10,{targetMask:'A,E1'}),effect(99,30,{order:1,targetMask:'A,e1'})]);
  assert.equal(calculate(s).normal.min,30);
  assert.equal(calculate(s,{}, {targetStates:[1]}).normal.min,10);
  const caster=fixture([effect(97,10,{targetMask:'A,*E2'})]);
  assert.equal(calculate(caster).normal.min,0);
  assert.equal(calculate(caster,{}, {casterStates:[2]}).normal.min,10);
});

test('HP thresholds, Pandawa forms, summons, shield and portal masks select one native branch',()=>{
  const mortal=spell('Attaque Mortelle');
  assert.equal(calculate(mortal,{}, {targetHpPercent:100}).normal.min,43);
  assert.equal(calculate(mortal,{}, {targetHpPercent:50}).normal.min,54);
  assert.equal(calculate(mortal,{}, {targetHpPercent:49}).normal.min,54);
  const panda=spell('Pandatak');
  assert.equal(calculate(panda).normal.min,38);
  assert.equal(calculate(panda,{}, {casterStates:[498]}).normal.min,46);
  for(const [name,normal,summon]of [['Remblai',20,25],['Banqueroute',36,47],['Concentration',20,30]]){
    assert.equal(calculate(spell(name)).normal.min,normal,name);
    assert.equal(calculate(spell(name),{}, {targetKind:'summon'}).normal.min,summon,name);
  }
  assert.equal(calculate(spell('Resquille')).normal.min,33);
  assert.equal(calculate(spell('Audace')).normal.min,26);
  assert.equal(calculate(spell('Audace'),{}, {conditions:['portal']}).normal.min,26);
  assert.equal(calculate(spell("Flèche d'Abolition")).normal.min,9);
  assert.equal(calculate(spell("Flèche d'Abolition"),{}, {conditions:['shield']}).normal.min,18);
  assert.equal(calculate(spell('Brancard'),{}, {conditions:['carried']}).lines.length,1);
});

test('effect order applies resistance reduction before the attack and not after it',()=>{
  const debuff=effect(215,20),hit=effect(97,100,{order:1});
  const target={...defaultTarget(),percent:{earth:50}};
  assert.equal(calculateNativeSpellDamage(fixture([debuff,hit]),{},target,200).normal.min,70);
  assert.equal(calculateNativeSpellDamage(fixture([{...debuff,order:2},hit]),{},target,200).normal.min,50);
});

test('HP relative damage ignores elemental characteristics and power, and push damage uses blocked cells',()=>{
  const s=fixture([effect(89,25)]), stats={hitPoints:4000,strength:1000,damagePercent:1000,allDamageBonus:500};
  assert.equal(calculate(s,stats,{casterHpPercent:50}).normal.min,500);
  const push=fixture([effect(5,3)]);
  assert.equal(calculate(push,{pushDamageBonus:100},{blockedPushCells:2,pushResistance:20}).normal.min,106);
  assert.equal(calculate(push,{pushDamageBonus:100},{blockedPushCells:0}).normal.min,0);
  assert.equal(calculate(push).pushDistance,3);
  assert.equal(calculate(push,{pushDamageBonus:100},{blockedPushCells:9}).normal.min,calculate(push,{pushDamageBonus:100},{blockedPushCells:3}).normal.min);
  assert.equal(calculate(fixture([effect(1067,20)]),stats,{targetHp:4000}).normal.min,800);
  assert.equal(calculate(fixture([effect(1063,100)]),stats).normal.min,100);
  assert.equal(calculate(fixture([effect(82,100)]),stats).normal.min,100);
  assert.equal(calculate(fixture([effect(1124,25)]),stats,{initialReceivedDamage:800}).normal.min,200);
  assert.equal(calculate(fixture([effect(1224,25)]),stats,{receivedDamage:400}).normal.min,100);
  assert.equal(calculate(fixture([effect(1131,1,{diceSide:6})]),{agility:100},{usedAp:3}).normal.min,36);
});

test('rune triggers resolve native effects and a separate cast source projects damage from the lance',()=>{
  assert.equal(calculate(spell('Surcharge Runique'),{}, {runes:{earth:1,fire:2}}).normal.min,30);
  assert.equal(calculate(spell('Manifestation'),{}, {runes:{earth:1}}).normal.min,15);
  assert.equal(calculate(spell('Tremblement'),{}, {zoneDistance:1}).normal.min,29);
  assert.equal(calculate(spell('Tremblement')).normal.min,29);
  assert.ok(calculate(spell('Muspel'),{}, {castSource:7139,casterStates:[3361]}).normal.min>0);
  assert.equal(calculate(spell('Jormun')).lines.length,1);
});

test('zone falloff and periodic occurrences use explicit scenario values',()=>{
  const periodic=fixture([effect(98,20,{triggers:'TB',zone:{shape:67,radius:3,minRadius:0,falloff:10,maxFalloff:4}})]);
  assert.equal(calculate(periodic,{}, {triggerCount:3,zoneDistance:2}).normal.min,48);
  assert.equal(calculate(periodic,{}, {triggerCount:0}).normal.min,0);
  assert.equal(calculate(spell('Épidémie')).normal.min,36);
  const fragment=spell('Piège à Fragmentation');
  assert.equal(calculate(fragment).normal.min,48);
  assert.equal(calculate(fragment,{}, {zoneDistance:2}).normal.min,37);
});

test('random native branches choose one outcome and client-only tooltip effects are not executed',()=>{
  const s=fixture([effect(97,10,{random:50,group:1}),effect(99,20,{random:50,group:2}),effect(100,999,{clientOnly:true})]);
  assert.equal(calculate(s).normal.min,10);
  assert.equal(calculate(s,{}, {randomChoices:{'random:1:1':[2]}}).normal.min,20);
  const bluff=calculate(spell('Bluff'),{}, {randomChoices:{'random:29746:1':[1,2,3,4]}});
  // Four distinct native Pique cards yield 4+6+8+10, then native royal bonus +28.
  assert.equal(bluff.normal.min,56);
  assert.equal(bluff.randomOptions[0].draws,4);
  assert.equal(bluff.lines.length,1);
  const boomerang=calculate(spell('Boomerang Perfide'));
  assert.deepEqual(boomerang.randomOptions[0].choices.map(c=>c.label.split(' · ')[0]).sort(),['Air','Eau','Feu','Terre']);
});

test('Glas charges and spell damage scenarios survive ranking independently for the same spell',()=>{
  const s=spell('Glas'), first=calculate(s,{}, {casterStates:[707],baseDamageBonus:3}), last=calculate(s,{}, {casterStates:[707],baseDamageBonus:18});
  assert.equal(first.normal.min,24);
  assert.equal(last.normal.min,84);
  const character={...defaultCharacter(5),allocationMode:'manual'};
  const request={character,target:defaultTarget(),constraints:[
    {id:'first',kind:'spell',spellId:s.id,mode:'normal',metric:'min',relation:'atLeast',target:24,priority:0,strict:true,scenario:{casterStates:[707],baseDamageBonus:3}},
    {id:'last',kind:'spell',spellId:s.id,mode:'normal',metric:'min',relation:'atLeast',target:84,priority:0,strict:true,scenario:{casterStates:[707],baseDamageBonus:18}},
  ],filters:{excludedItemIds:[],excludedTypeIds:[],excludedCategories:[],lockedSlots:{}},prices:{server:'Draconiros',values:{},ownedItemIds:[],mode:'total'},seconds:3};
  const result=evaluateBuild(catalog,request,{slots:{}});
  assert.ok(result.valid);
  assert.deepEqual(result.constraints.map(c=>c.value),[24,84]);
});

test('an invocation attack uses its native stats and inherited percentages, rather than the player stats',()=>{
  const s=catalog.spells.find(s=>s.classIds.includes(2)&&s.levels.some(l=>l.effects.some(e=>e.diceNum===8070)));
  assert.ok(s);
  const preview=calculate(s,{agility:1000,airDamageBonus:100,allDamageBonus:20});
  assert.ok(preview.summonAttacks.length);
  const attack=preview.summonAttacks[0], computed=calculate(s,{agility:1000,airDamageBonus:100,allDamageBonus:20},{summonSpellId:attack.id});
  assert.ok(computed.normal.min>0);
  assert.ok(computed.supported);
  assert.equal(computed.lines[0].normal.min,Math.floor(computed.lines[0].baseMin*6)+60);
});
