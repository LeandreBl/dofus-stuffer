/** Regression checks against the audited native 3.7.4.4 snapshot, without network/cache. */
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const catalogueText=await readFile(resolve(root,'data/catalog.json'),'utf8');
const c=JSON.parse(catalogueText), manifest=await read('data/source-manifest.json');
assert.equal(c.version,'3.7.4.4');
assert.equal(manifest.catalogSha256,createHash('sha256').update(catalogueText).digest('hex'));
assert.equal(manifest.patch.applied,false);
assert.equal(manifest.sourceFiles.length,11);
assert.equal(manifest.languageFiles.length,2);
assert.equal(c.classes.length,19);
assert.equal(c.items.length,3831);
assert.equal(c.spells.length,849);
assert.equal(c.spells.reduce((n,s)=>n+s.levels.length,0),1762);
for(const key of ['items','spells','sets','classes']) {
  assert.equal(new Set(c[key].map(x=>x.id)).size,c[key].length,`${key}: unique ids`);
  assert.ok(c[key].every(x=>x.name?.trim()),`${key}: translated names`);
}
const item=id=>{const found=c.items.find(i=>i.id===id);assert.ok(found,`item ${id}`);return found;};
for(const id of [16333,16335,34613]) assert.deepEqual(item(id).conditions,{kind:'stat',stat:'activeSetCount',operator:'<',value:2});
assert.deepEqual(item(34612).stats,{maxSummonedCreaturesBoost:1});
assert.deepEqual(item(34613).stats,{maxSummonedCreaturesBoost:2});
for(const [id,weight,wisdom] of [[34615,500,15],[34616,1000,30],[34617,2000,60]])assert.deepEqual(item(id).stats,{weight,wisdom});
assert.deepEqual(item(12624).stats,{tackleBlock:20,DodgeApLostProbability:20});
assert.equal(item(8992).forgeable,true);
assert.equal(item(8993).forgeable,true);
assert.equal(item(8619).forgeable,false);
assert.ok(item(8619).unsupportedEffects.length>0);
assert.deepEqual(item(8619).stats,{});
assert.ok(c.items.filter(i=>i.isLegendary).every(i=>i.unsupportedEffects.length>0));
assert.equal(c.stats.find(s=>s.key==='damagePercent').unit,'');
const punitive=c.spells.find(s=>s.id===32456);
assert.deepEqual(punitive,await read('data/punitive-fixture.json'));
const rank=punitive.levels.find(l=>l.grade===2);
assert.equal(rank.minPlayerLevel,137);
assert.equal(rank.rangeCanBeBoosted,true);
for(const [key,min,max] of [['effects',30,34],['criticalEffects',36,41]]) {
  const damage=rank[key].find(e=>e.effectId===97);
  assert.equal(damage.diceNum,min);assert.equal(damage.diceSide,max);
  assert.deepEqual(rank[key].filter(e=>e.effectId===293).map(e=>[e.diceNum,e.value,e.delay,e.duration]),[[32456,24,1,1],[32456,32,2,1]]);
  assert.ok(rank[key].filter(e=>e.effectId===3793).every(e=>!e.visibleInTooltip));
}
const explosive=c.spells.find(s=>s.name==='Flèche Explosive').levels.at(-1);
assert.equal(explosive.criticalHitProbability,15);
assert.equal(explosive.maxCastPerTurn,2);
assert.deepEqual(explosive.effects.filter(e=>e.effectId===99).map(e=>[e.diceNum,e.diceSide]),[[29,31]]);
assert.deepEqual(explosive.criticalEffects.filter(e=>e.effectId===99).map(e=>[e.diceNum,e.diceSide]),[[35,37]]);
for(const icon of new Set([...c.items,...c.spells,...c.classes].map(x=>x.icon))) {
  assert.ok(icon.startsWith('/game/'),`local asset ${icon}`);
  await access(resolve(root,'apps/web/public',icon.slice(1)));
}
console.log('Catalogue 3.7.4.4 vérifié : provenance, nouveaux trophées, critères, FM, passifs, Punitive, Explosive et icônes locales.');
