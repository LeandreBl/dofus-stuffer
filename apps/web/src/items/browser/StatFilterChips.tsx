import { X } from "lucide-react";
import type { Catalog } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";

export function StatFilterChips({ catalog, statKeys, onChange }: {
  catalog: Catalog;
  statKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  return (
    <div className="stat-filter-chips">
      {statKeys.map((key) => {
        const stat = catalog.stats.find((entry) => entry.key === key);
        return (
          <button key={key} className="spell-element-chip active" aria-label={`Retirer le filtre ${stat?.name || key}`} onClick={() => onChange(statKeys.filter((value) => value !== key))}>
            <StatIcon stat={stat} /> {stat?.name || key} <X size={12} />
          </button>
        );
      })}
      <button className="button small ghost" onClick={() => onChange([])}>Tout effacer</button>
      <span className="spell-filter-hint">Triés par {catalog.stats.find((stat) => stat.key === statKeys[0])?.name}</span>
    </div>
  );
}
