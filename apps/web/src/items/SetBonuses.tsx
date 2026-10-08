import type { Catalog, EquipmentSet } from "@dofus/shared";
import { StatIcon } from "../components/StatIcon";
import { fmt, statUnit } from "../lib/format";

/** Set bonuses per number of equipped items. */
export function SetBonuses({ set, catalog, active }: { set: EquipmentSet; catalog: Catalog; active?: number }) {
  return <div className="set-tiers">{set.bonuses.map((bonus) => (
    <div className={`set-tier ${active === bonus.count ? "active" : ""}`} key={bonus.count}>
      <small>{bonus.count} objets</small>
      {Object.entries(bonus.stats).map(([key, value]) => {
        const stat = catalog.stats.find((entry) => entry.key === key);
        return <div key={key} className={`stat-line ${value < 0 ? "malus" : ""}`}>
          <StatIcon stat={stat} /><span>{stat?.name || key}</span>
          <strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
        </div>;
      })}
    </div>
  ))}</div>;
}
