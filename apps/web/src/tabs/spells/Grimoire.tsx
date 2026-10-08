import type { Catalog, Element, SpellDamage } from "@dofus/shared";
import { SearchField } from "../../components/SearchField";
import { StatIcon } from "../../components/StatIcon";
import { elementKeys, elementNames } from "./damage";
import { SpellListRow } from "./SpellListRow";
import { GRIMOIRE_PAGE, type useGrimoire } from "./useGrimoire";

const filterElements: Element[] = ["earth", "fire", "water", "air", "neutral"];

export function Grimoire({ catalog, characterLevel, grimoire, damages }: {
  catalog: Catalog;
  characterLevel: number;
  grimoire: ReturnType<typeof useGrimoire>;
  damages: Map<number, SpellDamage>;
}) {
  const { search, setSearch, classFilter, setClassFilter, elementFilter, setElementFilter, setSelectedId, limit, setLimit, spells, spellElements, selected } = grimoire;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Grimoire des sorts</h2>
          <p>Normal et critique, côte à côte.</p>
        </div>
        <span className="counter">{spells.length} sorts</span>
      </div>
      <div className="catalog-toolbar">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setLimit(GRIMOIRE_PAGE);
          }}
          placeholder="Trouver un sort…"
        />
        <select
          value={classFilter}
          aria-label="Classe des sorts"
          onChange={(event) => {
            setClassFilter(event.target.value);
            setLimit(GRIMOIRE_PAGE);
          }}
        >
          <option value="all">Toutes les classes</option>
          <option value="common">Communs</option>
          {catalog.classes.map((gameClass) => (
            <option key={gameClass.id} value={gameClass.id}>
              {gameClass.name}
            </option>
          ))}
        </select>
      </div>
      <div className="spell-element-filters" role="group" aria-label="Filtrer par élément de dégâts">
        <button
          className={`spell-element-chip ${!elementFilter.length ? "active" : ""}`}
          aria-pressed={!elementFilter.length}
          onClick={() => { setElementFilter([]); setLimit(GRIMOIRE_PAGE); }}
        >
          Tous
        </button>
        {filterElements.map((element) => (
          <button
            key={element}
            className={`spell-element-chip ${elementFilter.includes(element) ? "active" : ""}`}
            aria-pressed={elementFilter.includes(element)}
            aria-label={`Dégâts ${elementNames[element]}`}
            onClick={() => {
              setElementFilter((current) => current.includes(element)
                ? current.filter((entry) => entry !== element) : [...current, element]);
              setLimit(GRIMOIRE_PAGE);
            }}
          >
            <StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />
            {elementNames[element]}
          </button>
        ))}
      </div>
      <p className="spell-filter-hint">
        {elementFilter.length
          ? `Dégâts ${elementFilter.map((element) => elementNames[element]).join(" ou ")} · sorts multiéléments inclus.`
          : "Clique sur un ou plusieurs éléments pour filtrer les sorts."}
      </p>
      <div className="spell-list">
        {spells.slice(0, limit).map((spell) => (
          <SpellListRow
            key={spell.id}
            spell={spell}
            catalog={catalog}
            characterLevel={characterLevel}
            elements={spellElements.get(spell.id) ?? []}
            damage={damages.get(spell.id)}
            active={spell.id === selected?.id}
            onSelect={() => setSelectedId(spell.id)}
          />
        ))}
        {!spells.length && (
          <div className="empty-state">
            <p>Aucun sort ne correspond à ces filtres.</p>
            <button className="button ghost" onClick={() => {
              setSearch(""); setClassFilter("all"); setElementFilter([]); setLimit(GRIMOIRE_PAGE);
            }}>Réinitialiser les filtres</button>
          </div>
        )}
      </div>
      {spells.length > limit && (
        <button className="button ghost more-button" onClick={() => setLimit((value) => value + 100)}>
          Afficher plus de sorts
        </button>
      )}
      <p className="pagination-summary">
        {Math.min(limit, spells.length)} / {spells.length} sorts · variantes
        incluses
      </p>
    </section>
  );
}
