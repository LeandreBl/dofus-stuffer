import type { Catalog, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt, statUnit } from "../../../lib/format";

export function StatsPanel({ title, keys, catalog, stats, className = "", labelled = false }: {
  title: string;
  /** Exposes the panel as a named region. */
  labelled?: boolean;
  keys: string[];
  catalog: Catalog;
  stats: Stats;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()} aria-label={labelled ? title : undefined}>
      <h3>{title}</h3>
      <div className="stats-list">
        {keys.map((key) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          return (
            <div className="stat-line" key={key}>
              <StatIcon stat={stat} />
              <span>{stat?.name || key}</span>
              <strong>
                {fmt(stats[key] || 0)}
                {statUnit(stat)}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
