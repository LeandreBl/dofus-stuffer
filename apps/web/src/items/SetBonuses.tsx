import { useState } from "react";
import type { Catalog, EquipmentSet } from "@dofus/shared";
import { StatIcon } from "../components/StatIcon";
import { fmt, statUnit } from "../lib/format";

/** Set bonuses picked by number of items; defaults to the equipped tier, else the full set. */
export function SetBonuses({ set, catalog, active }: { set: EquipmentSet; catalog: Catalog; active?: number }) {
  const [tierCount, setTierCount] = useState(active);
  const tier = set.bonuses.find((bonus) => bonus.count === tierCount) ?? set.bonuses.at(-1);
  return <>
    {set.bonuses.length > 1 && <div className="set-tier-picker" role="group" aria-label="Nombre d’objets équipés">
      {set.bonuses.map((bonus) => <button key={bonus.count} className={`${bonus === tier ? "active" : ""} ${bonus.count === active ? "equipped" : ""}`} aria-pressed={bonus === tier} title={`Bonus avec ${bonus.count} objets`} onClick={() => setTierCount(bonus.count)}>{bonus.count}</button>)}
    </div>}
    {tier && <div className="set-tiers"><div className={`set-tier ${active === tier.count ? "active" : ""}`}>
      <small>{tier.count} objets</small>
      {Object.entries(tier.stats).map(([key, value]) => {
        const stat = catalog.stats.find((entry) => entry.key === key);
        return <div key={key} className={`stat-line ${value < 0 ? "malus" : ""}`}>
          <StatIcon stat={stat} /><span>{stat?.name || key}</span>
          <strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
        </div>;
      })}
    </div></div>}
  </>;
}
