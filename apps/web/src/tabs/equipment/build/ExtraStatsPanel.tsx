import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { Catalog, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { StatFilterPanel } from "../../../items/browser/StatFilterPanel";

/** Hand-entered stats (forgemagic, …) added to the equipment to test damage. */
export function ExtraStatsPanel({ catalog, stats, onChange }: {
  catalog: Catalog;
  stats: Stats;
  onChange: (stats: Stats) => void;
}) {
  const [picking, setPicking] = useState(false);
  const set = (stat: string, value: number) => onChange({ ...stats, [stat]: value });
  const remove = (stat: string) => {
    const next = { ...stats };
    delete next[stat];
    onChange(next);
  };
  return (
    <section className="panel extra-stats">
      <h3>Stats manuelles (FM…)</h3>
      <div className="stats-list">
        {Object.entries(stats).map(([stat, value]) => {
          const definition = catalog.stats.find((entry) => entry.key === stat);
          return (
            <div className="stat-line" key={stat}>
              <StatIcon stat={definition} />
              <span>{definition?.name || stat}</span>
              <div className="allocation-stepper">
                <button aria-label={`Retirer 1 ${definition?.name || stat}`} onClick={() => set(stat, value - 1)}><Minus size={11} /></button>
                <input type="number" step="1" aria-label={`Valeur ${definition?.name || stat}`} value={value} onChange={(event) => set(stat, Math.trunc(Number(event.target.value)) || 0)} />
                <button aria-label={`Ajouter 1 ${definition?.name || stat}`} onClick={() => set(stat, value + 1)}><Plus size={11} /></button>
              </div>
              <button className="icon-button" aria-label={`Retirer ${definition?.name || stat}`} onClick={() => remove(stat)}><X size={14} /></button>
            </div>
          );
        })}
      </div>
      <button className="button small ghost" aria-expanded={picking} onClick={() => setPicking(!picking)}>
        {picking ? <X size={14} /> : <Plus size={14} />} {picking ? "Fermer" : "Ajouter une caractéristique"}
      </button>
      {picking && <StatFilterPanel catalog={catalog} items={catalog.items} statKeys={Object.keys(stats)} onToggle={(key) => key in stats ? remove(key) : set(key, 1)} />}
    </section>
  );
}
