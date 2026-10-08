import { useEffect, useMemo, useState } from "react";
import {
  calculateSpellCriticalChance,
  calculateSpellDamage,
  defaultTarget,
  type Catalog,
  type Character,
  type Element,
} from "@dofus/shared";
import { searchable } from "../../lib/format";
import { getSpellDamageElements } from "../../lib/spell-elements";
import { setUrlParam } from "../../lib/url";

const SPELL_FILTERS_KEY = "dofus-spell-filters-v1";
export const GRIMOIRE_PAGE = 70;

/** Grimoire filters and selection; they survive leaving the tab, the class filter follows a class change. */
export function useGrimoire(catalog: Catalog, character: Character, initialSpellId?: number) {
  const [search, setSearch] = useState("");
  const [savedFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SPELL_FILTERS_KEY) || "null"); } catch { return null; }
  });
  // A shared spell from another class must stay visible.
  const sharedSpell = catalog.spells.find((spell) => spell.id === initialSpellId);
  const [classFilter, setClassFilter] = useState<string>(
    sharedSpell && !sharedSpell.classIds.length ? "common" :
    sharedSpell && !sharedSpell.classIds.includes(character.classId) ? "all" :
    savedFilters?.forClass === character.classId && typeof savedFilters.classFilter === "string" ? savedFilters.classFilter : String(character.classId),
  );
  const [view, setView] = useState<"spells" | "weapon">(!initialSpellId && savedFilters?.view === "weapon" ? "weapon" : "spells");
  const [elementFilter, setElementFilter] = useState<Element[]>(!sharedSpell && Array.isArray(savedFilters?.elements) ? savedFilters.elements : []);
  const spellElements = useMemo(
    () => new Map(catalog.spells.map((spell) => [spell.id, getSpellDamageElements(spell, character.level, catalog)])),
    [catalog.spells, character.level],
  );
  // Pure boosts (no damage element, no summon or trigger damage) stay out of the grimoire,
  // unless the character's critical stat changes their critical chance.
  const supportOnly = useMemo(
    () => new Set(catalog.spells.filter((spell) => !spellElements.get(spell.id)?.length
      && calculateSpellCriticalChance(spell, { criticalHit: 10 }, character.level) === calculateSpellCriticalChance(spell, {}, character.level)
      && calculateSpellDamage(spell, {}, defaultTarget(), character.level, { catalog }).damageKind === "support").map((spell) => spell.id)),
    [catalog, spellElements, character.level],
  );
  const [selectedId, setSelectedId] = useState(
    sharedSpell?.id ||
      catalog.spells.find((spell) => spell.id === savedFilters?.selectedId)?.id ||
      catalog.spells.find((spell) => spell.classIds.includes(character.classId) && /punitive/i.test(spell.name))?.id ||
      catalog.spells.find((spell) => spell.classIds.includes(character.classId))?.id ||
      catalog.spells[0]?.id,
  );
  const [limit, setLimit] = useState(GRIMOIRE_PAGE);
  useEffect(() => {
    try { localStorage.setItem(SPELL_FILTERS_KEY, JSON.stringify({ forClass: character.classId, classFilter, elements: elementFilter, selectedId, view })); } catch { /* Filters still work for this visit. */ }
  }, [classFilter, elementFilter, character.classId, selectedId, view]);
  const spells = useMemo(
    () =>
      catalog.spells.filter(
        (spell) =>
          !supportOnly.has(spell.id) &&
          (classFilter === "all" ||
            (classFilter === "common" ? !spell.classIds.length : spell.classIds.includes(Number(classFilter)))) &&
          (!elementFilter.length || spellElements.get(spell.id)?.some((element) => elementFilter.includes(element))) &&
          searchable(spell.name).includes(searchable(search)),
      ).sort((a, b) => (a.levels[0]?.minPlayerLevel ?? 0) - (b.levels[0]?.minPlayerLevel ?? 0)),
    [catalog, classFilter, search, elementFilter, spellElements, supportOnly],
  );
  const selected = spells.find((spell) => spell.id === selectedId) || spells[0];
  useEffect(() => setUrlParam("spell", view === "spells" ? selected?.id : undefined), [view, selected?.id]);
  return {
    search, setSearch, classFilter, setClassFilter, elementFilter, setElementFilter,
    view, setView, setSelectedId, limit, setLimit, spells, spellElements, selected,
  };
}
