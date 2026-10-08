import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getPreviewBoosts, type Catalog, type Character, type CombatPreviewState } from "@dofus/shared";
import { SearchField } from "../../../components/SearchField";
import { plainText, searchable } from "../../../lib/format";
import { BoostCard } from "./BoostCard";

export function BoostPicker({ catalog, character, boosts, state, onChange }: {
  catalog: Catalog; character: Character; boosts: ReturnType<typeof getPreviewBoosts>; state: CombatPreviewState; onChange: (state: CombatPreviewState) => void;
}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState(String(character.classId));
  const shown = boosts.filter(boost => (classFilter === "all" || !boost.spell.classIds.length || boost.spell.classIds.includes(Number(classFilter)))
    && searchable(plainText(boost.spell.name)).includes(searchable(search)));
  const active = boosts.filter(boost => state.boosts[String(boost.spell.id)]?.enabled);
  const visible = [...active, ...shown.filter(boost => !state.boosts[String(boost.spell.id)]?.enabled)];
  return <details className="combat-boost-picker" open>
    <summary className="combat-section-title">Sorts de boost <ChevronDown size={14} /></summary>
    <div className="catalog-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Trouver un boost…" />
      <select aria-label="Classe des boosts" value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="all">Toutes les classes</option>{catalog.classes.map(gameClass => <option key={gameClass.id} value={gameClass.id}>{gameClass.name}</option>)}</select></div>
    <p className="combat-effect-note">Les boosts de ta classe et les sorts communs sont proposés. Choisis une autre classe pour simuler un boost reçu d’un allié de ton niveau.</p>
    <div className="combat-effect-grid combat-boost-list">{visible.map(boost => {
      const key = String(boost.spell.id);
      return <BoostCard key={key} boost={boost} activation={state.boosts[key] || { enabled: false }} characterLevel={character.level} catalog={catalog}
        onChange={activation => onChange({ ...state, boosts: { ...state.boosts, [key]: activation } })} />;
    })}</div>
    {!visible.length && <p className="combat-empty">Aucun boost calculable avec ces filtres et ce niveau.</p>}
  </details>;
}
