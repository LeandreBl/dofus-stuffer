/** A deliberately scoped overlay over DofusDB 3.6.12.16, verified against Ankama's final 3.7 notes.
 * Never apply these deltas blindly to a later import. Unspecified mechanics remain explicit warnings.
 */
export const PATCH37_SOURCE = 'https://www.dofus.com/fr/mmorpg/actualites/maj/1772037-mise-jour-3-7/details';
export const PATCH37_VERSION = '3.6.12.16+patch-3.7.20261006';
const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[’]/g,"'").toLowerCase();
const damageIds = new Set([91,92,93,94,95,96,97,98,99,100]);

export function applyPatch37(catalog) {
  if (catalog.version !== '3.6.12.16') return { applied:false, reason:'The overlay is pinned to source version 3.6.12.16.' };
  const changes = [];
  const item = name => {
    const matches = catalog.items.filter(i => normalize(i.name) === normalize(name) && Object.keys(i.stats).length);
    if (matches.length !== 1) throw new Error(`Patch 3.7: item ${name} resolves to ${matches.length} records`);
    return matches[0];
  };
  const spell = name => {
    const matches = catalog.spells.filter(s => normalize(s.name) === normalize(name));
    if (matches.length !== 1) throw new Error(`Patch 3.7: spell ${name} resolves to ${matches.length} records`);
    return matches[0];
  };
  function setStats(i, values) {
    const before = {...i.stats};
    for (const [key,value] of Object.entries(values)) {
      if (value === null) delete i.stats[key]; else i.stats[key]=value;
    }
    changes.push({kind:'item-stats',id:i.id,name:i.name,before,after:{...i.stats}});
  }
  function family(name, values) {
    const members=catalog.items.filter(i=>i.category==='Trophées' && normalize(i.name.replace(/ (mineur|majeur)e?$/, ''))===normalize(name));
    if(members.length!==3) throw new Error(`Patch 3.7: family ${name} contains ${members.length} items`);
    for(const i of members) {
      const index=/mineur/.test(i.name)?0:/majeur/.test(i.name)?2:1;
      setStats(i,Object.fromEntries(Object.entries(values).map(([key,v])=>[key,Array.isArray(v)?v[index]:v])));
    }
  }
  const crit=[1,3,6], small=[5,10,20], normal=[10,20,40], reduction=[4,8,16], doubleReduction=[8,16,32];
  for(const name of ['Acrobate','Furibond','Joueur','Puissant','Savant','Ravageur Air','Ravageur Eau','Ravageur Feu','Ravageur Terre','Ravageur Neutre']) family(name,{criticalHit:crit});
  family('Adamantin',{pushDamageReduction:[15,30,60],tackleBlock:small});
  for(const [fr,en] of [['Air','air'],['Eau','water'],['Feu','fire'],['Terre','earth'],['Neutre','neutral']]) {
    family(`Cuirassé ${fr}`,{[`${en}ElementResistPercent`]:[2,4,8]});
    family(`Carapace ${fr}`,{[`${en}ElementResistPercent`]:[4,8,16]});
    family(`Saccageur ${fr}`,{[`${en}DamageBonus`]:[6,12,24]});
    family(`Dévastateur ${fr}`,{[`${en}DamageBonus`]:[6,12,24]});
    const oldMalus={Air:'fire',Eau:'neutral',Feu:'earth',Terre:'air',Neutre:'water'}[fr];
    family(`Muraille ${fr}`,{[`${en}ElementReduction`]:fr==='Terre'?[15,30,60]:[12,24,48],[`${oldMalus}ElementResistPercent`]:null,initiative:[-150,-300,-600]});
  }
  family('Engourdisseur',{apReduction:reduction,tackleBlock:small});
  family('Fugitif',{DodgeMpLostProbability:small,tackleBlock:small});
  family('Fuyard',{tackleEvade:small,DodgeMpLostProbability:small});
  family('Initiateur',{initiative:[150,300,600],criticalDamageBonus:[2,4,8]});
  family('Insaisissable',{DodgeApLostProbability:small,tackleEvade:small});
  family('Porteur',{weight:[500,1000,2000],magicFind:small});
  family('Pousseur',{pushDamageBonus:normal,criticalHit:crit});
  family('Ralentisseur',{mpReduction:reduction,tackleEvade:small});
  family('Rempart',{criticalDamageReduction:[6,12,24],tackleEvade:small});
  family('Soigneur',{healBonus:[6,12,24],criticalHit:crit});
  family('Survivant',{tackleEvade:small});
  family('Tacleur',{tackleBlock:small});
  // The final note names the new secondary stat but gives no amounts: never infer them.
  for(const i of catalog.items.filter(i=>/^Tacleur/.test(i.name))) i.dataWarnings=['3.7 : Esquive PA ajoutée au Tacleur ; valeur absente des notes finales et en attente du catalogue 3.7.'];
  for(const [name,key] of [['Astucieux','intelligence'],['Equilibriste','agility'],['Forcené','strength'],['Taquin','chance'],['Cascadeur','agility'],['Chanceux','chance'],['Enragé','strength'],['Érudit','intelligence']]) family(name,{[key]:[30,60,120]});
  family('Bastion',{criticalDamageReduction:[12,24,48]});
  family('Bloqueur',{tackleBlock:normal,tackleEvade:[-10,-20,-40]});
  family('Bousculeur',{pushDamageBonus:[20,40,80],tackleBlock:[-10,-20,-40]});
  family('Docteur',{healBonus:[12,24,48],vitality:null,tackleEvade:[-6,-12,-24]});
  family('Entraveur',{mpReduction:doubleReduction,DodgeApLostProbability:[-8,-16,-32]});
  family('Evanescent',{DodgeMpLostProbability:normal,DodgeApLostProbability:[-10,-20,-40]});
  family('Féroce',{criticalDamageBonus:[-3,-6,-12]});
  family('Imprenable',{DodgeApLostProbability:normal,DodgeMpLostProbability:[-10,-20,-40]});
  family('Inflexible',{pushDamageReduction:[30,60,120],tackleEvade:[-10,-20,-40]});
  family('Paralyseur',{apReduction:doubleReduction,DodgeMpLostProbability:[-8,-16,-32]});
  family('Précurseur',{initiative:[300,600,1200]});
  family('Vagabond',{tackleEvade:normal,tackleBlock:[-10,-20,-40]});
  for(const [name,key,values] of [
    ['Cavaleur','DodgeMpLostProbability',normal],['Culbuteur','pushDamageBonus',[20,40,80]],['Déserteur','tackleEvade',normal],
    ['Étourdisseur','apReduction',doubleReduction],['Évasif','DodgeApLostProbability',normal],['Fonceur','initiative',[300,600,1200]],
    ['Fortification','criticalDamageReduction',[12,24,48]],['Guérisseur','healBonus',[12,24,48]],['Obstructeur','tackleBlock',normal],
    ['Solide','pushDamageReduction',[30,60,120]],['Temporiseur','mpReduction',doubleReduction],
  ]) family(name,{[key]:values});
  for(const i of catalog.items.filter(i=>i.category==='Trophées' && i.conditionsText==='Pk<3')) {
    changes.push({kind:'item-condition',id:i.id,name:i.name,before:i.conditions,after:{kind:'stat',stat:'activeSetCount',operator:'<',value:2}});
    i.conditions={kind:'stat',stat:'activeSetCount',operator:'<',value:2};
    i.conditionsText='Nombre de panoplies actives < 2';
  }
  setStats(item("Amour d'Helséphine"),{actionPoints:2});
  for(const [name,key,damage] of [['Hachebarde de Guerre','intelligence','fireDamageBonus'],['Plume de Buhorado','agility','airDamageBonus'],['Frisson de Brumaire','chance','waterDamageBonus']]) {
    setStats(item(name),{[key]:60,damagePercent:60,[damage]:null,neutralDamageBonus:10,earthDamageBonus:10,fireDamageBonus:10,waterDamageBonus:10,airDamageBonus:10});
  }
  setStats(item('Couronne de Brâm Barbe-Monde'),{dealtDamageMultiplierWeapon:null,criticalHit:10});
  setStats(item('Étreinte de Servitude'),{neutralDamageBonus:15,earthDamageBonus:15,fireDamageBonus:15,waterDamageBonus:15,airDamageBonus:15});
  setStats(item('Bouclier Miroir'),{criticalDamageReduction:null,receivedDamageMultiplierMelee:null});
  setStats(item('Crocobur'),{DodgeApLostProbability:null,DodgeMpLostProbability:null,apReduction:-20,mpReduction:-20});
  setStats(item("Ferveur d'Amayiro"),{damagePercent:100,pushDamageBonus:30});
  setStats(item('Bravoure de Rykke Errel'),{neutralDamageBonus:null,earthDamageBonus:null,fireDamageBonus:null,waterDamageBonus:null,airDamageBonus:null,dealtDamageMultiplierMelee:6});
  setStats(item('Bottes du Cul Botté'),{damagePercent:80,neutralElementReduction:null,pushDamageReduction:40});
  setStats(item('Prysantor'),{criticalDamageReduction:50,pushDamageReduction:-25});
  for(const id of [8992,8993]) {
    const i=catalog.items.find(i=>i.id===id);
    if(!i) throw new Error(`Patch 3.7: cursed weapon ${id} missing`);
    i.forgeable=true;
    changes.push({kind:'item-forgeability',id,name:i.name,after:true});
  }
  const itemNotes={
    "Ponctualité d'Henual":'3.7 : passif de téléportation et de gain PA remanié ; non simulé.',
    "Amour d'Helséphine":'3.7 : passif de soin 6 %, une fois par type de déclenchement et par tour ; non simulé.',
    'Lance-Éclair de Menalt':'3.7 : nouveau passif Dommages Poussée par PM utilisé et don de PM ; non simulé.',
    'Hachebarde de Guerre':'3.7 : dégâts 37–43 et vol 10–13 dans le meilleur élément, bonus critique +10 ; attaque d’arme non simulée.',
    'Plume de Buhorado':'3.7 : attaque dans le meilleur élément et retrait du cumul maximal du passif ; non simulés.',
    'Frisson de Brumaire':'3.7 : attaque dans le meilleur élément ; non simulée.',
    'Crocobur':'3.7 : soins du passif prolongés à 2 tours ; non simulés.',
    'Pestilence de Corruption':'3.7 : poison ne touchant plus les alliés ; non simulé.',
    'Ciseaux du Destin':'3.7 : bonus critique de l’arme +6 ; attaque d’arme non simulée.',
    'Balance-Fléau de Misère':'3.7 : bonus critique de l’arme +3 ; attaque d’arme non simulée.',
  };
  for(const [name,note] of Object.entries(itemNotes)) {
    const i=item(name); i.dataWarnings=[...(i.dataWarnings??[]),note];
    changes.push({kind:'item-warning',id:i.id,name:i.name,note});
  }
  const healingWeapons=['Marteau Possédé','Baguette de Malléfisk','Arc Hétype','Faux Enracinée de Malter','Arc de Flèche Mauve','Dagues Hischantes','Pelle Gicque','Baguette du Scarabosse Doré','Marteau Pinambour','Lance de trappeur albueran','Arc Hidsad','Baguette Larvesque','Bouquet de Roses démoniaques','Racine Hécouanone','Baguette de Kouartz'];
  for(const name of healingWeapons) {
    const matches=catalog.items.filter(i=>normalize(i.name)===normalize(name));
    if(matches.length!==1) throw new Error(`Patch 3.7: healing weapon ${name} is ambiguous`);
    matches[0].dataWarnings=['3.7 : soins désormais Neutre et conversions de forgemagie 100 % ou 10 % ; soins et attaques d’armes non simulés.'];
  }
  const rangeChanges={
    'Flèche de Recul':[6,7,8],'Flèche Glacée':[6,7,8],'Flèche Évasive':[6,8],'Flèche Détonante':[6,7,8],
    'Flèche Persécutrice':[8,10],'Flèche Cinglante':[6,7,8],"Flèche d'Immobilisation":[6,7,8],
    'Flèche de Rédemption':[10],'Flèche Dévorante':[6,8],'Flèche Fulminante':[7],'Flèche Boomerang':[8],
    'Tir Perçant':[6,8],'Œil de Taupe':[5,6,7],
  };
  for(const [name,values] of Object.entries(rangeChanges)) {
    const s=spell(name);
    if(values.length!==s.levels.length) throw new Error(`Patch 3.7: rank count ${name}`);
    s.levels.forEach((l,n)=>{changes.push({kind:'spell-range',id:s.id,grade:l.grade,before:l.range,after:values[n]});l.range=values[n];});
  }
  function levelChanges(name,values,damage) {
    const s=spell(name);
    if(damage && damage.length!==s.levels.length) throw new Error(`Patch 3.7: damage rank count ${name}`);
    s.levels.forEach((l,n)=>{
      const before=structuredClone(l);
      Object.assign(l,values);
      if(damage) {
        for(const [key,offset] of [['effects',0],['criticalEffects',2]]) {
          const lines=l[key].filter(e=>damageIds.has(e.effectId));
          if(lines.length!==1) throw new Error(`Patch 3.7: direct damage count ${name}, ${key}, ${lines.length}`);
          lines[0].diceNum=damage[n][offset]; lines[0].diceSide=damage[n][offset+1];
        }
      }
      changes.push({kind:'spell-rank',id:s.id,name:s.name,grade:l.grade,before,after:structuredClone(l)});
    });
  }
  levelChanges('Flèche Explosive',{criticalHitProbability:15,maxCastPerTurn:2},[[18,20,22,24],[24,26,29,31],[29,31,35,37]]);
  levelChanges('Flèche Paralysante',{criticalHitProbability:15,maxCastPerTurn:2},[[30,32,36,38]]);
  levelChanges('Flèche Ralentissante',{criticalHitProbability:15,maxCastPerTurn:2},[[27,29,32,35],[31,33,37,40]]);
  levelChanges('Carreaux Destructeurs',{},[[29,32,35,39],[36,40,43,48]]);
  levelChanges('Œil pour Œil',{},[[16,18,19,21],[21,24,25,28],[24,27,29,32]]);
  levelChanges('Flèche Évasive',{apCost:2,criticalHitProbability:5,maxCastPerTurn:3,maxCastPerTarget:2,minRange:2},[[13,15,16,19],[16,19,20,23]]);
  levelChanges('Flèche Tyrannique',{minRange:1});
  levelChanges('Représailles',{minRange:0});
  levelChanges('Flèche Massacrante',{minRange:3,range:8});
  levelChanges('Glas',{apCost:3,minCastInterval:2});
  for(const name of ['Flèche Glacée','Œil pour Œil']) {
    const s=spell(name); s.levels.forEach((l,n)=>{for(const e of [...l.effects,...l.criticalEffects]) if(e.effectId===293 && e.diceNum===s.id) e.value=3+n;});
  }
  const complexSpells={
    'Flèches Amoureuses':'restriction ligne/diagonale retirée',
    'Pluie de Flèches':'dégressivité de zone retirée',
    'Carreaux Destructeurs':'poussée directionnelle et dégressivité de zone',
    "Flèche d'Abolition":'zones par rang modifiées',
    'Œil pour Œil':'bonus de base +3/+4/+5, rotation conditionnelle',
    'Représailles':'multiplicateur de dommages subis retiré et Pesanteur appliquée avant dégâts',
    'Vendetta':'multiplicateur dommages subis x110 % pendant 1 tour',
    'Sentinelle':'détection des invisibles autour du lanceur et des Balises',
    'Tirs Puissants':'malus de portée et réduction de portée minimale différés',
    'Flèche de Barrage':'poussée directionnelle',
    "Flèche d'Expiation":'malus de soins reçus réduit à 1 tour',
    'Flèche Évasive':'retrait PA/PM supprimé et poussée/recul à 1 case',
    'Flèche Glacée':'bonus de base +3/+4/+5 cumulable 2 fois',
    'Flèche Vagabonde':'recul 1/2/3 cases selon rang',
    'Flèche Éclatante':'poussée sur case centrale',
    'Flèche du Jugement':'seconde attaque 20–22, critique 24–26',
    'Flèche Massacrante':'zone demi-cercle 2 et bonus de base +10',
    'Balise Tactique':'PV 100 % des PV de base, dommages alliés x50 %',
    'Glas':'dégâts 3, critique 4, bonus par Téléfrag +3',
  };
  for(const [name,mechanic] of Object.entries(complexSpells)) {
    const s=spell(name);
    s.dataWarnings=[`3.7 : ${mechanic}. Mécanique complète non simulée ; aperçu partiel.`];
    changes.push({kind:'spell-warning',id:s.id,name:s.name,note:s.dataWarnings[0]});
  }
  for(const s of catalog.spells.filter(s=>s.classIds.includes(12) && /Tonneau|Bambou/.test(s.name))) s.dataWarnings=['3.7 : PV des invocations calculés sur les PV de base (Tonneau 60 %, Bambou 45 %) ; invocations non simulées.'];
  // Power is an elemental-stat contribution for damage, never a percent of final damage.
  for(const stat of catalog.stats) if(stat.key==='damagePercent') stat.unit='';
  catalog.version=PATCH37_VERSION;
  catalog.warnings=[...(catalog.warnings??[]).filter(w=>!w.includes('sans exo')), 'Base DofusDB 3.6.12.16 avec correctifs documentés 3.7 du 6 octobre 2026 ; pas un import natif 3.7.',
    'Dresseur, Dompteur et les trois Mule ne sont pas encore importés : identifiants, jets et icônes 3.7 indisponibles dans la source.',
    'Les mécaniques 3.7 non représentables par le simulateur sont signalées sur les sorts et objets concernés.'];
  return {applied:true,source:PATCH37_SOURCE,sourceVersion:'3.6.12.16',version:catalog.version,verifiedAt:'2026-10-07',changes,
    unresolved:['Five new trophies missing from the upstream snapshot.','Tacleur AP parry amounts omitted from the final notes.','Weapon damage/healing and conditional spell/passive mechanics require native 3.7 effects.'],
    scope:'Maximum natural stat rolls, active-set trophy conditions, supported numeric spell changes. Original item raw effects retain the source snapshot; patched stats are authoritative for equipment totals.'};
}
