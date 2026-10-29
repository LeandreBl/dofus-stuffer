import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, Swords, Upload, X } from "lucide-react";
import {
  calculatePreviewWeaponDamage,
  calculateSpellCriticalChance,
  calculateSpellDamage,
  createCombatPreviewContext,
  defaultTarget,
  evaluateBuild,
  getSpellTurn,
  hasStatScalingSpellDamage,
  type Build,
  type Catalog,
  type Character,
  type OptimizationRequest,
  type DamageRange,
  type SpellDamage,
} from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { StatIcon } from "../../components/StatIcon";
import { manualBuildRequest } from "../../lib/build-preview";
import { fmt, money, statUnit, uid } from "../../lib/format";
import { parseStuff } from "../../workspace/profile-transfer";
import { getSpellDamageElements } from "../../lib/spell-elements";
import { StatFilterPanel } from "../../items/browser/StatFilterPanel";
import { ItemHover } from "../../items/ItemHover";
import { SpellHover } from "../spells/SpellHover";
import { CombatPreviewPanel } from "../spells/combat/CombatPreviewPanel";
import { loadCombatPreview, saveCombatPreview } from "../spells/combat/combat-preview-storage";
import { FoldPanel } from "./FoldPanel";
import { DamageHover } from "./DamageHover";
import { WEAPON, weaponMatches, filterSpells, sortByElement, SpellFilters, type SpellFilterState } from "./SpellFilters";

/** Spells recast as soon as possible since combat turn 1 stack their per-cast bonuses; when the spell
 * cannot be cast on `offset`, its latest earlier cast is shown. */
function latestCast(damage: SpellDamage, offset: number) {
  for (let turn = Math.max(0, offset); turn >= 0; turn--) {
    const cast = getSpellTurn(damage, turn);
    if (cast?.available) return cast;
  }
  return undefined;
}

/** Characteristics high enough for any scaling damage to show up. */
const PROBE_STATS = { strength: 1000, intelligence: 1000, chance: 1000, agility: 1000, damagePercent: 200 };

interface DamageEntry { supported: boolean; cast?: { available: boolean; normal: DamageRange; critical: DamageRange | null }; chance: number | null }

export interface ComparedStuff { id: string; name: string; character: Character; build: Build }

const STAT_KEYS = [
  "hitPoints", "actionPoints", "movementPoints", "range", "maxSummonedCreaturesBoost", "criticalHit",
  "vitality", "wisdom", "strength", "intelligence", "chance", "agility", "damagePercent",
  "allDamageBonus", "criticalDamageBonus", "neutralDamageBonus", "earthDamageBonus", "fireDamageBonus", "waterDamageBonus", "airDamageBonus",
  "dealtDamageMultiplierSpells", "dealtDamageMultiplierWeapon", "dealtDamageMultiplierDistance", "dealtDamageMultiplierMelee",
  "neutralElementResistPercent", "earthElementResistPercent", "fireElementResistPercent", "waterElementResistPercent", "airElementResistPercent",
  "initiative", "tackleEvade", "tackleBlock", "DodgeApLostProbability", "DodgeMpLostProbability", "apReduction", "mpReduction", "healBonus", "magicFind",
];

/** Stuff file contents with the character it was exported with, falling back to the current one. */
function readStuff(catalog: Catalog, text: string, name: string, current: Character): ComparedStuff {
  const saved = JSON.parse(text)?.character;
  const character: Character = saved && catalog.classes.some((entry) => entry.id === saved.classId) && Number.isFinite(saved.level)
    ? { ...current, ...saved }
    : current;
  return { id: uid(), name: name.replace(/\.json$/i, ""), character, build: parseStuff(catalog, text, character).build };
}

export function CompareTab({ catalog, request, stuffs, onChange, notify }: {
  catalog: Catalog;
  request: OptimizationRequest;
  stuffs: ComparedStuff[];
  onChange: (stuffs: ComparedStuff[]) => void;
  notify: (message: string) => void;
}) {
  const [view, setView] = useState<"stats" | "damage">("stats");
  // An empty selection shows every row: all non-zero stats, all filtered spells.
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [spellFilters, setSpellFilters] = useState<SpellFilterState>({ search: "", classFilter: String(request.character.classId), elements: [], selected: [] });
  const rows = useMemo(() => stuffs.map((stuff) => {
    const evaluation = evaluateBuild(catalog, manualBuildRequest({ ...request, character: stuff.character, constraints: [] }), stuff.build);
    return { stuff, evaluation };
  }), [catalog, request, stuffs]);
  const level = stuffs[0]?.character.level ?? request.character.level;
  // « Coup de poing » (id 0) is replaced by the equipped weapon row.
  // Spells without a damage element are kept only when they still deal damage (e.g. Libération deals none).
  const damageSpells = useMemo(() => sortByElement(catalog, catalog.spells.filter((spell) => spell.id !== 0 && hasStatScalingSpellDamage(spell, level, catalog)
    && (getSpellDamageElements(spell, level, catalog).length > 0
      || calculateSpellDamage(spell, PROBE_STATS, defaultTarget(), level, { catalog }).normal.average > 0)), level), [catalog, level]);
  const filteredSpells = useMemo(() => filterSpells(catalog, damageSpells, level, spellFilters), [catalog, damageSpells, level, spellFilters]);
  // Picked spells win over the filters, so a search does not hide them from the cards.
  const shownSpells = spellFilters.selected.length ? damageSpells.filter((spell) => spellFilters.selected.includes(spell.id)) : filteredSpells;
  const showWeapon = spellFilters.selected.length ? spellFilters.selected.includes(WEAPON) : weaponMatches(spellFilters);
  // Same passives & boosts as « Mes dégâts », applied to each stuff with its own equipment.
  const [combatState, setCombatState] = useState(loadCombatPreview);
  useEffect(() => saveCombatPreview(combatState), [combatState]);
  const contexts = useMemo(() => rows.map(({ stuff, evaluation }) => createCombatPreviewContext(catalog, stuff.build, stuff.character, evaluation.stats, combatState)),
    [catalog, rows, combatState]);
  const damages = useMemo(() => view !== "damage" ? [] : rows.map(({ stuff }, index) => {
    // Cast on the combat turn chosen in « Passifs & boosts », with the stats of that turn.
    const stats = contexts[index].statsAtOffset[0];
    const entries = new Map<number, DamageEntry>(shownSpells.map((spell) => {
      const damage = calculateSpellDamage(spell, stats, request.target, stuff.character.level, { catalog });
      return [spell.id, {
        supported: damage.supported && (!spell.classIds.length || spell.classIds.includes(stuff.character.classId)),
        cast: latestCast(damage, combatState.turn - 1),
        chance: calculateSpellCriticalChance(spell, stats, stuff.character.level),
      }];
    }));
    const weapon = catalog.items.find((item) => item.id === stuff.build.slots.weapon && item.slotType === "weapon");
    if (showWeapon && weapon) {
      const damage = calculatePreviewWeaponDamage(weapon, stuff.character, request.target, contexts[index]);
      entries.set(WEAPON, { supported: damage.supported, cast: { available: true, normal: damage.normal, critical: damage.critical }, chance: damage.critChance });
    }
    return entries;
  }), [view, rows, contexts, shownSpells, showWeapon, catalog, request.target, combatState.turn]);

  async function upload(files: FileList | null) {
    const added: ComparedStuff[] = [];
    for (const file of Array.from(files ?? [])) {
      try { added.push(readStuff(catalog, await file.text(), file.name, request.character)); }
      catch { notify(`${file.name} : ce fichier ne contient pas de stuff Dofus Stuffer valide.`); }
    }
    if (added.length) onChange([...stuffs, ...added]);
  }
  const best = (values: number[]) => Math.max(...values);
  const allStats = useMemo(() => {
    const rank = (key: string) => { const index = STAT_KEYS.indexOf(key); return index < 0 ? STAT_KEYS.length : index; };
    // Same stats as the item filter: those some equipment or set bonus can carry.
    const carried = new Set([...catalog.items, ...catalog.sets.flatMap((set) => set.bonuses)].flatMap((entry) => Object.keys(entry.stats)));
    return catalog.stats.filter((stat) => carried.has(stat.key)).map((stat) => stat.key)
      .sort((a, b) => rank(a) - rank(b));
  }, [catalog]);
  const shownStats = selectedStats.length ? selectedStats : allStats.filter((key) => rows.some(({ evaluation }) => evaluation.stats[key]));
  const statValues = Object.fromEntries(shownStats.map((key) => [key, rows.map(({ evaluation }) => evaluation.stats[key] || 0)]));
  // Critical average once the spell crits at least 85 % of the time, normal average otherwise.
  const shown = (spellId: number) => damages.map((map) => {
    const entry = map.get(spellId);
    if (!entry?.supported || !entry.cast?.available) return { critical: false, value: 0 };
    const critical = (entry.chance ?? 0) >= 85 && !!entry.cast.critical;
    return { critical, value: (critical ? entry.cast.critical : entry.cast.normal)?.average ?? 0 };
  });

  return (
    <>
      <div className="compare-toolbar">
        <div className="segment" role="tablist" aria-label="Comparaison">
          <button role="tab" aria-selected={view === "stats"} className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}><BarChart3 size={14} /> Caractéristiques</button>
          <button role="tab" aria-selected={view === "damage"} className={view === "damage" ? "active" : ""} onClick={() => setView("damage")}><Swords size={14} /> Dégâts</button>
        </div>
      </div>
      {stuffs.length > 0 && view === "stats" && <FoldPanel title="Filtres des caractéristiques" summary="Choisis les caractéristiques à comparer.">
        <StatFilterPanel catalog={catalog} items={catalog.items} statKeys={selectedStats}
          onToggle={(key) => setSelectedStats(selectedStats.includes(key) ? selectedStats.filter((entry) => entry !== key) : [...selectedStats, key])} />
        <p className="spell-filter-hint compare-hint">
          {selectedStats.length ? `${selectedStats.length} caractéristique(s) choisie(s).` : "Toutes les caractéristiques non nulles sont affichées."}
          {selectedStats.length > 0 && <button className="button small ghost" onClick={() => setSelectedStats([])}>Tout effacer</button>}
        </p>
      </FoldPanel>}
      {stuffs.length > 0 && view === "damage" && <CombatPreviewPanel catalog={catalog} build={stuffs[0].build} character={stuffs[0].character} state={combatState} context={contexts[0]} onChange={setCombatState} />}
      {stuffs.length > 0 && view === "damage" && <FoldPanel title="Filtres des sorts" summary="Choisis les sorts à comparer.">
        <SpellFilters catalog={catalog} level={level} spells={filteredSpells} filters={spellFilters} onChange={setSpellFilters} />
      </FoldPanel>}
      <div className="compare-cards">
          {rows.map(({ stuff, evaluation }, index) => (
            <section className="panel compare-card" key={stuff.id}>
              <div className="compare-card-head">
                <div>
                  <h3 title={stuff.name}>{stuff.name}</h3>
                  <small>{catalog.classes.find((entry) => entry.id === stuff.character.classId)?.name} · niv. {stuff.character.level} · {evaluation.cost === null ? "prix incomplet" : money(evaluation.cost)}</small>
                </div>
                <button className="icon-button" aria-label={`Retirer ${stuff.name}`} onClick={() => onChange(stuffs.filter((entry) => entry.id !== stuff.id))}><X size={15} /></button>
              </div>
              <div className="compare-items">
                {Object.values(stuff.build.slots).map((id, slot) => {
                  const item = catalog.items.find((entry) => entry.id === id);
                  return item && <GameImage key={slot} src={item.icon} alt={item.name} title={item.name} />;
                })}
              </div>
              <div className="stats-list">
                {view === "stats" ? shownStats.map((key) => {
                  const stat = catalog.stats.find((entry) => entry.key === key);
                  const value = statValues[key][index];
                  return (
                    <div className={`stat-line ${stuffs.length > 1 && value === best(statValues[key]) ? "compare-best" : ""}`} key={key}>
                      <StatIcon stat={stat} />
                      <span title={stat?.name || key}>{stat?.name || key}</span>
                      <strong>{fmt(value)}{statUnit(stat)}</strong>
                    </div>
                  );
                }) : [...(showWeapon ? [WEAPON] : []), ...shownSpells.map((spell) => spell.id)].map((id) => {
                  const spell = shownSpells.find((entry) => entry.id === id);
                  const weapon = catalog.items.find((item) => item.id === stuff.build.slots.weapon);
                  const entry = damages[index].get(id);
                  const values = shown(id), { critical, value } = values[index];
                  const supported = entry?.supported && entry.cast?.available;
                  const name = spell ? spell.name : weapon ? `Arme · ${weapon.name}` : "Arme · aucune équipée";
                  return (
                    <div className="stat-line compare-spell" key={id}>
                      {spell ? <SpellHover spell={spell} characterLevel={stuff.character.level} catalog={catalog}><GameImage src={spell.icon} alt="" /></SpellHover>
                        : weapon ? <ItemHover item={weapon} catalog={catalog} request={request}><GameImage src={weapon.icon} alt="" /></ItemHover>
                        : <StatIcon stat={catalog.stats.find((stat) => stat.key === "weaponDamagePercent")} />}
                      {spell ? <SpellHover spell={spell} characterLevel={stuff.character.level} catalog={catalog}><span tabIndex={0}>{name}</span></SpellHover>
                        : weapon ? <ItemHover item={weapon} catalog={catalog} request={request}><span tabIndex={0}>{name}</span></ItemHover>
                        : <span>{name}</span>}
                      {entry?.chance ? <small className="compare-chance">{fmt(entry.chance)} %</small> : null}
                      <strong>
                        {!supported ? "—" : <>
                          <DamageHover catalog={catalog} title={spell?.name ?? weapon?.name ?? "Arme"} subtitle={stuff.name} icon={spell?.icon ?? weapon?.icon}
                            detail={{ normal: entry!.cast!.normal, critical: entry!.cast!.critical, chance: entry!.chance, criticalShown: critical }}>
                            <span tabIndex={0} className={stuffs.length > 1 && value === best(values.map((entry) => entry.value)) ? "compare-best" : ""}>{fmt(value)}{critical && <StatIcon stat={catalog.stats.find((entry) => entry.key === "criticalHit")} />}</span>
                          </DamageHover>
                        </>}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <label className="panel compare-card compare-add" title="Importer des stuffs (JSON)">
            <Plus size={40} />
            <span>{stuffs.length ? "Importer un autre stuff" : "Importer des stuffs exportés avec « Exporter mon stuff »"}</span>
            <input type="file" accept=".json,application/json" multiple hidden onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
          </label>
      </div>
      {view === "damage" && stuffs.length > 0 && <p className="inline-notice">Dégâts moyens d’un lancer au tour de combat choisi dans « Passifs & boosts » (sorts relancés dès que possible depuis le tour 1 : leurs bonus par lancer se cumulent), en coup critique (icône critique) à partir de 85 % de critique, en coup normal sinon, sur la cible réglée dans « Mes dégâts », avec les passifs et boosts choisis (ceux des objets listés pour le premier stuff). Les sorts d’une autre classe que le stuff affichent « — ».</p>}
    </>
  );
}
