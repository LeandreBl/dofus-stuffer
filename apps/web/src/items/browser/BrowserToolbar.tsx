import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SearchField } from "../../components/SearchField";

export type BrowserFilters = {
  search: string;
  typeId: string;
  visibility: string;
  // Kept as typed so the inputs can be cleared while editing; empty means no bound.
  minLevel: string;
  maxLevel: string;
  statKeys: string[];
};

export function BrowserToolbar({ filters, types, showItemFilters, statsOpen, onChange, onToggleStats }: {
  filters: BrowserFilters;
  types: [number, string][];
  showItemFilters: boolean;
  statsOpen: boolean;
  onChange: (changes: Partial<BrowserFilters>) => void;
  onToggleStats: () => void;
}) {
  return (
    <div className="catalog-toolbar">
      <SearchField
        value={filters.search}
        onChange={(search) => onChange({ search })}
        placeholder="Chercher un objet, une panoplie…"
      />
      {showItemFilters && <select
        aria-label="Type d’objet"
        value={filters.typeId}
        onChange={(event) => onChange({ typeId: event.target.value })}
      >
        <option value="all">Tous les types</option>
        {types.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>}
      {showItemFilters && <select
        aria-label="Afficher les objets"
        value={filters.visibility}
        onChange={(event) => onChange({ visibility: event.target.value })}
      >
        <option value="all">Tous les objets</option>
        <option value="excluded">Objets exclus</option>
        <option value="locked">Objets verrouillés</option>
      </select>}
      <label className="level-range">
        <span>Niv.</span>
        <input type="number" min={1} max={200} aria-label="Niveau minimum" value={filters.minLevel} onChange={(event) => onChange({ minLevel: event.target.value })} />
        <span>–</span>
        <input type="number" min={1} max={200} aria-label="Niveau maximum" value={filters.maxLevel} onChange={(event) => onChange({ maxLevel: event.target.value })} />
      </label>
      <button
        className={`button ghost filter-toggle ${statsOpen || filters.statKeys.length ? "active" : ""}`}
        aria-expanded={statsOpen}
        onClick={onToggleStats}
      >
        <SlidersHorizontal size={14} /> Caractéristiques
        {!!filters.statKeys.length && <span className="filter-count">{filters.statKeys.length}</span>}
        <ChevronDown size={13} />
      </button>
    </div>
  );
}
