import { Check, Plus } from "lucide-react";
import type { Catalog, Element, Spell } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { SearchField } from "../../components/SearchField";
import { StatIcon } from "../../components/StatIcon";
import { searchable } from "../../lib/format";
import { getSpellDamageElements } from "../../lib/spell-elements";
import { elementKeys, elementNames } from "../spells/damage";
import { SpellHover } from "../spells/SpellHover";

const filterElements: Element[] = ["earth", "fire", "water", "air", "neutral"];

/** Pseudo spell id of the equipped weapon row. */
export const WEAPON = -1;
/** The weapon row follows the search only: it has no class and its element depends on the weapon. */
export const weaponMatches = (filters: SpellFilterState) => searchable("Arme corps à corps").includes(searchable(filters.search));

export interface SpellFilterState { search: string; classFilter: string; elements: ElementFilter[]; selected: number[] }
/** "other": common spells (Flamèche, Foudroiement de Grunob…) and damage without an identified element. */
type ElementFilter = Element | "other";

/** Damage elements used to sort and filter; none for the "other" spells, whatever they hit with. */
const spellElements = (catalog: Catalog, spell: Spell, level: number): Element[] =>
  spell.classIds.length ? getSpellDamageElements(spell, level, catalog) : [];

/** Damage type order: earth, fire, water, air, neutral, multi-element after their first element, "other" last, then name. */
export function sortByElement(catalog: Catalog, spells: Spell[], level: number) {
  const key = (spell: Spell) => {
    const elements = spellElements(catalog, spell, level).map((element) => filterElements.indexOf(element)).sort();
    return { first: elements.length ? elements[0] : filterElements.length, count: elements.length };
  };
  const keys = new Map(spells.map((spell) => [spell.id, key(spell)]));
  return [...spells].sort((a, b) => {
    const ka = keys.get(a.id)!, kb = keys.get(b.id)!;
    return ka.first - kb.first || ka.count - kb.count || a.name.localeCompare(b.name, "fr");
  });
}

/** Spells matching the grimoire-like filters (search, class, element). */
export function filterSpells(catalog: Catalog, spells: Spell[], level: number, filters: SpellFilterState) {
  return spells.filter((spell) =>
    // A class keeps the common spells (Flamèche, Foudroiement de Grunob…) every class can learn.
    (filters.classFilter === "all" || !spell.classIds.length || (filters.classFilter !== "common" && spell.classIds.includes(Number(filters.classFilter)))) &&
    (!filters.elements.length || ((elements) => elements.some((element) => filters.elements.includes(element))
      || (!elements.length && filters.elements.includes("other")))(spellElements(catalog, spell, level))) &&
    searchable(spell.name).includes(searchable(filters.search)));
}

/** Grimoire filters, then one chip per matching spell to pick the compared rows. */
export function SpellFilters({ catalog, level, spells, filters, onChange }: {
  catalog: Catalog;
  level: number;
  spells: Spell[];
  filters: SpellFilterState;
  onChange: (filters: SpellFilterState) => void;
}) {
  const patch = (changes: Partial<SpellFilterState>) => onChange({ ...filters, ...changes });
  const toggle = (id: number) => patch({ selected: filters.selected.includes(id) ? filters.selected.filter((entry) => entry !== id) : [...filters.selected, id] });
  return (
    <div className="compare-filter-panel">
      <div className="catalog-toolbar">
        <SearchField value={filters.search} onChange={(search) => patch({ search })} placeholder="Trouver un sort…" />
        <select value={filters.classFilter} aria-label="Classe des sorts" onChange={(event) => patch({ classFilter: event.target.value })}>
          <option value="all">Toutes les classes</option>
          <option value="common">Communs uniquement</option>
          {catalog.classes.map((gameClass) => <option key={gameClass.id} value={gameClass.id}>{gameClass.name}</option>)}
        </select>
      </div>
      <div className="item-stat-filters">
        <div className="category-tabs" role="group" aria-label="Filtrer par élément de dégâts">
          <button className={!filters.elements.length ? "active" : ""} aria-pressed={!filters.elements.length} onClick={() => patch({ elements: [] })}>Tout</button>
          {[...filterElements, "other" as const].map((element) => (
            <button key={element} className={filters.elements.includes(element) ? "active" : ""} aria-pressed={filters.elements.includes(element)}
              onClick={() => patch({ elements: filters.elements.includes(element) ? filters.elements.filter((entry) => entry !== element) : [...filters.elements, element] })}>
              {element !== "other" && <StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />}
              {element === "other" ? "Autre" : elementNames[element]}
            </button>
          ))}
        </div>
        <div className="stat-tiles">
          {weaponMatches(filters) && <button title="Arme équipée de chaque stuff" className={`stat-tile ${filters.selected.includes(WEAPON) ? "added" : ""}`} aria-pressed={filters.selected.includes(WEAPON)} onClick={() => toggle(WEAPON)}>
            <StatIcon stat={catalog.stats.find((stat) => stat.key === "weaponDamagePercent")} />
            <span>Arme</span>
            {filters.selected.includes(WEAPON) ? <Check size={13} /> : <Plus size={13} />}
          </button>}
          {spells.map((spell) => {
            const selected = filters.selected.includes(spell.id);
            return (
              <SpellHover key={spell.id} spell={spell} characterLevel={level} catalog={catalog}>
                <button className={`stat-tile ${selected ? "added" : ""}`} aria-pressed={selected} onClick={() => toggle(spell.id)}>
                  <GameImage className="stat-icon" src={spell.icon} />
                  <span>{spell.name}</span>
                  {selected ? <Check size={13} /> : <Plus size={13} />}
                </button>
              </SpellHover>
            );
          })}
        </div>
      </div>
      <p className="spell-filter-hint compare-hint">
        {filters.selected.length ? `${filters.selected.length} sort(s) choisi(s).` : "Tous les sorts filtrés sont affichés."}
        {filters.selected.length > 0 && <button className="button small ghost" onClick={() => patch({ selected: [] })}>Tout effacer</button>}
      </p>
    </div>
  );
}
