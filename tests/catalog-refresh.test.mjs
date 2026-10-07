import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { compareGameVersions, parseUnityJson, resolveUnityResource, refreshCatalog } from '../scripts/refresh-catalog.mjs';

const releaseRoot = 'https://github.com/dofusdude/dofus3-main/releases/download/';
const sourceApi = 'https://api.github.com/repos/dofusdude/dofus3-main/releases/latest';
async function workspace(fn) {
  const parent = resolve(tmpdir());
  const dir = await mkdtemp(join(parent,'dofus-refresh-test-'));
  try { await fn(dir); } finally { if(dirname(dir)===parent) await rm(dir,{recursive:true,force:true}); }
}
function unity(rows) {
  return { objectsById:{m_values:{Array:rows.map((row,index)=>({rid:String(index+1)}))}}, references:{RefIds:rows.map((data,index)=>({rid:String(index+1),type:{class:'FixtureData'},data}))} };
}
function fixtureSource(version='3.7.4.5') {
  const wrap = Array => ({Array});
  const effect = {actionId:118,diceNum:10,diceSide:20,value:0,m_flags:1};
  const files = {
    'fr.json':{entries:{1:'Force',2:'Objet',3:'Coiffe',4:'Flèche',5:'Classe',6:'Terre'}},
    'en.json':{entries:{5:'Cra'}},
    'breeds.json':unity([{id:9,shortNameId:5,maleLook:'{1|80||50}',breedSpellsId:wrap([42])}]),
    'characteristics.json':unity([{id:10,keyword:'strength',categoryId:2,nameId:1}]),
    'effects.json':unity([{id:118,characteristic:10,characteristicOperator:'+',descriptionId:6}]),
    'item_types.json':unity([{id:16,superTypeId:10,categoryId:0,nameId:3}]),
    'spell_variants.json':unity([{id:1,breedId:9,spellIds:wrap([42])}]),
    'spell_types.json':unity([{id:1,longNameId:4}]),
    'spells.json':unity([{id:42,nameId:4,descriptionId:4,typeId:1,iconId:45,spellLevels:wrap([420])}]),
    'spell_levels.json':unity([{id:420,spellId:42,grade:1,minPlayerLevel:1,apCost:4,minRange:1,range:8,m_flags:64,criticalHitProbability:5,minCastInterval:0,maxCastPerTurn:1,maxCastPerTarget:1,maxStack:1,effects:wrap([effect]),criticalEffect:wrap([effect])}]),
    'items.json':unity([{id:2,typeId:16,iconId:123,nameId:2,level:200,itemSetId:7,criterions:'',m_flags:64,possibleEffects:wrap([effect])}]),
    'item_sets.json':unity([{id:7,nameId:2,effects:wrap([{values:wrap([effect])}])}]),
  };
  const metadata = {tag_name:version,draft:false,prerelease:false,assets:Object.keys(files).map(name=>({name,browser_download_url:`${releaseRoot}${version}/${name}`}))};
  const requested = [];
  return {files,metadata,requested,fetcher:async url=>{
    requested.push(url);
    if(url===sourceApi)return new Response(JSON.stringify(metadata));
    const key=Object.keys(files).find(name=>url===`${releaseRoot}${version}/${name}`);
    assert.ok(key,`Unexpected download: ${url}`);
    return new Response(JSON.stringify(files[key]));
  }};
}
const active = () => ({version:'3.7.4.4',servers:['Draconiros'],classes:[{id:9,icon:'/game/classes/9.png',illustration:'/game/classes/portrait-9.png'}],stats:[{id:10,key:'strength'}],items:[{id:2,icon:'/game/items/123.png'}],spells:[{id:42,icon:'/game/spells/45.png'}],sets:[{id:7}]});

test('catalogue versions compare every numeric component and reject ambiguous versions',()=>{
  assert.equal(compareGameVersions('3.7.10.1','3.7.9.9'),1);
  assert.equal(compareGameVersions('3.7.1.0','3.7.4.4'),-1);
  assert.equal(compareGameVersions('3.6.12.16','3.6.12.16+patch-3.7.20261006'),0);
  assert.throws(()=>compareGameVersions('beta','3.7.4.4'),/Version/);
});

test('Unity references preserve adjacent 64-bit ids, arrays, nested effects and translations',()=>{
  const tree=parseUnityJson('{"objectsById":{"m_values":{"Array":[{"rid":398376278494025440},{"rid":398376278494025441}]}},"references":{"RefIds":[{"rid":398376278494025440,"type":{"class":"Item"},"data":{"id":1,"nameId":5,"effects":{"Array":[{"rid":398376278494025442}]}}},{"rid":398376278494025441,"type":{"class":"Item"},"data":{"id":2,"nameId":6,"effects":{"Array":[]}}},{"rid":398376278494025442,"type":{"class":"Effect"},"data":{"actionId":118,"diceNum":15}}]}}');
  const rows=resolveUnityResource(tree,{fr:{5:'Premier',6:'Second'}});
  assert.deepEqual(rows.map(row=>row.name.fr),['Premier','Second']);
  assert.deepEqual(rows[0].effects,[{actionId:118,diceNum:15,className:'Effect'}]);
  assert.deepEqual(rows[1].effects,[]);
});

test('Unity invalid, cyclic and duplicate references cannot silently corrupt a catalogue',()=>{
  const tree=unity([{id:1,link:{rid:'2'}}]);
  assert.throws(()=>resolveUnityResource(tree,{}),/absente/);
  tree.references.RefIds[0].data.link.rid='1';
  assert.throws(()=>resolveUnityResource(tree,{}),/cyclique/);
  tree.references.RefIds.push(tree.references.RefIds[0]);
  assert.throws(()=>resolveUnityResource(tree,{}),/dupliquée/);
});

test('integer protection leaves quoted text, escapes and finite decimals intact and rejects malformed JSON',()=>{
  const literal='Text says "rid": 398376278494025441; \\path\\; 12345678901234567';
  assert.equal(parseUnityJson(JSON.stringify({text:literal})).text,literal);
  assert.deepEqual(parseUnityJson('{"safe":9007199254740991,"unsafe":9007199254740992,"negative":-398376278494025441,"decimal":1.25,"exponent":2e3}'),{safe:9007199254740991,unsafe:'9007199254740992',negative:'-398376278494025441',decimal:1.25,exponent:2000});
  assert.throws(()=>parseUnityJson('{"bad":012345678901234567}'),SyntaxError);
});

test('weekly refresh skips same and older versions before downloading any resource',async()=>workspace(async dir=>{
  const current=join(dir,'active.json'),output=join(dir,'candidate.json');
  await writeFile(current,JSON.stringify(active()));
  for(const [version,status]of[['3.7.4.4','unchanged'],['3.7.1.1','older']]){
    const source=fixtureSource(version);
    assert.equal((await refreshCatalog({current,output,fetcher:source.fetcher})).status,status);
    assert.deepEqual(source.requested,[sourceApi]);
    await assert.rejects(access(output));
  }
}));

test('weekly refresh runs real normalization in staging and preserves active file, servers and local icons',async()=>workspace(async dir=>{
  const current=join(dir,'active.json'),output=join(dir,'candidate.json');
  const original=JSON.stringify(active());
  await writeFile(current,original);
  const source=fixtureSource();
  const result=await refreshCatalog({current,output,fetcher:source.fetcher});
  assert.equal(result.status,'updated');
  const candidate=JSON.parse(await readFile(output,'utf8'));
  assert.equal(candidate.version,'3.7.4.5');
  assert.deepEqual(candidate.items[0].stats,{strength:20});
  assert.equal(candidate.items[0].icon,'/game/items/123.png');
  assert.equal(candidate.spells[0].icon,'/game/spells/45.png');
  assert.deepEqual(candidate.servers,['Draconiros']);
  assert.equal(await readFile(current,'utf8'),original);
  assert.deepEqual((await readdir(dir)).sort(),['active.json','candidate.json']);
}));

test('missing new art produces a usable neutral placeholder without fetching remote icons',async()=>workspace(async dir=>{
  const current=join(dir,'active.json'),output=join(dir,'candidate.json');
  await writeFile(current,JSON.stringify(active()));
  const source=fixtureSource();
  source.files['items.json'].references.RefIds[0].data.iconId=999;
  await refreshCatalog({current,output,fetcher:source.fetcher});
  const candidate=JSON.parse(await readFile(output,'utf8'));
  assert.equal(candidate.items[0].icon,'');
  assert.ok(candidate.warnings.some(warning=>warning.includes('icônes')));
}));

test('refresh refuses overwriting active or existing output and rejects tampered release assets',async()=>workspace(async dir=>{
  const current=join(dir,'active.json'),output=join(dir,'candidate.json');
  await writeFile(current,JSON.stringify(active()));
  const source=fixtureSource();
  await assert.rejects(refreshCatalog({current,output:current,fetcher:source.fetcher}),/distinct/);
  source.metadata.assets[0].browser_download_url='https://example.com/untrusted.json';
  await assert.rejects(refreshCatalog({current,output,fetcher:source.fetcher}),/release absent/);
  const checksumSource=fixtureSource();
  checksumSource.metadata.assets[0].digest='sha256:incorrect';
  await assert.rejects(refreshCatalog({current,output,fetcher:checksumSource.fetcher}),/Empreinte/);
  await writeFile(output,'keep');
  await assert.rejects(refreshCatalog({current,output,fetcher:fixtureSource().fetcher}),/EEXIST/);
  assert.equal(await readFile(output,'utf8'),'keep');
}));
