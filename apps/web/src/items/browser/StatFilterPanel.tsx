import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Catalog, EquipmentItem } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { STAT_CATEGORY_ORDER } from "../../lib/stat-categories";

/** Characteristics that some equipment actually carries, grouped like "Ce que je vise". */
export function StatFilterPanel({ catalog, items, statKeys, onToggle }: {
  catalog: Catalog;
  items: EquipmentItem[];
  statKeys: string[];
  onToggle: (key: string) => void;
}) {
  const [statCategory, setStatCategory] = useState("Tout");
  const statGroups = useMemo(() => {
    const carried = new Set([...items, ...catalog.sets.flatMap((set) => set.bonuses)].flatMap((entry) => Object.keys(entry.stats)));
    return STAT_CATEGORY_ORDER.map((category) => [
      category,
      catalog.stats.filter((stat) => stat.category === category && carried.has(stat.key)),
    ] as const).filter(([, stats]) => stats.length);
  }, [catalog, items]);
  return (
    <div className="item-stat-filters">
      <div className="category-tabs" aria-label="Catégories de caractéristiques">
        {["Tout", ...statGroups.map(([category]) => category)].map((name) => (
          <button key={name} className={statCategory === name ? "active" : ""} onClick={() => setStatCategory(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="stat-tiles">
        {statGroups
          .filter(([category]) => statCategory === "Tout" || statCategory === category)
          .flatMap(([, stats]) => stats)
          .map((stat) => {
            const selected = statKeys.includes(stat.key);
            return (
              <button
                key={stat.key}
                className={`stat-tile ${selected ? "added" : ""}`}
                aria-pressed={selected}
                onClick={() => onToggle(stat.key)}
              >
                <StatIcon stat={stat} />
                <span>{stat.name}</span>
                {selected ? <Check size={13} /> : <Plus size={13} />}
              </button>
            );
          })}
      </div>
    </div>
  );
}
