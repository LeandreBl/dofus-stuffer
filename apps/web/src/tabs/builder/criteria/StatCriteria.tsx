import { Check, Info, Plus, Search } from "lucide-react";
import { STAT_CAPS, type Catalog, type Constraint, type StatDefinition } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { searchable, statUnit, uid } from "../../../lib/format";
import { STAT_CATEGORY_ORDER } from "../../../lib/stat-categories";

export function StatCriteria({ catalog, constraints, search, category, onCategory, onAdd, onEdit }: {
  catalog: Catalog;
  category: string;
  onCategory: (category: string) => void;
  constraints: Constraint[];
  search: string;
  onAdd: (criterion: Constraint) => void;
  onEdit: (criterion: Constraint) => void;
}) {
  const categories = [
    "Tout",
    ...Array.from(new Set(catalog.stats.map((stat) => stat.category))).sort(
      (a, b) => STAT_CATEGORY_ORDER.indexOf(a) - STAT_CATEGORY_ORDER.indexOf(b),
    ),
  ];
  const stats = catalog.stats.filter(
    (stat) => (category === "Tout" || category === stat.category) && searchable(stat.name).includes(searchable(search)),
  );
  function addStat(stat: StatDefinition) {
    const existing = constraints.find((entry) => entry.kind === "stat" && entry.statKey === stat.key);
    if (existing) {
      onEdit(existing);
      return;
    }
    onAdd({
      id: uid(),
      kind: "stat",
      statKey: stat.key,
      target: Math.min(STAT_CAPS[stat.key] ?? Infinity, stat.defaultTarget || (statUnit(stat) === "%" ? 30 : 100)),
      relation: "atLeast",
      priority: 0,
      strict: false,
    });
  }
  return (
    <>
      <div className="category-tabs" aria-label="Catégories de caractéristiques">
        {categories.map((name) => (
          <button key={name} className={category === name ? "active" : ""} onClick={() => onCategory(name)}>
            {name}
          </button>
        ))}
      </div>
      {categories
        .slice(1)
        .filter((name) => stats.some((stat) => stat.category === name))
        .map((name) => (
          <div className="stat-section" key={name}>
            <div className="section-label">{name}</div>
            <div className="stat-tiles">
              {stats
                .filter((stat) => stat.category === name)
                .map((stat) => {
                  const added = constraints.some((entry) => entry.statKey === stat.key);
                  return (
                    <button className={`stat-tile ${added ? "added" : ""}`} key={stat.key} onClick={() => addStat(stat)}>
                      <StatIcon stat={stat} />
                      <span>{stat.name}</span>
                      {added ? <Check size={13} /> : <Plus size={13} />}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      {!stats.length && (
        <div className="empty-state">
          <Search size={20} />
          <p>Aucune caractéristique trouvée.</p>
        </div>
      )}
      <div className="stats-footnote">
        <Info size={12} /> Les caractéristiques proviennent du catalogue de
        la version {catalog.version}.
      </div>
    </>
  );
}
