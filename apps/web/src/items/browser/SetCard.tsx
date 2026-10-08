import { useState } from "react";
import { Shield } from "lucide-react";
import type { Build, Catalog, EquipmentItem, OptimizationRequest } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { StatIcon } from "../../components/StatIcon";
import { fmt, statUnit } from "../../lib/format";
import { ItemHover } from "../ItemHover";
import type { SetEntry } from "./set-entries";

export function SetCard({ entry, catalog, request, build, statKeys, onItem }: {
  entry: SetEntry;
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  statKeys: string[];
  onItem: (item: EquipmentItem) => void;
}) {
  const { set, members, totals, level } = entry;
  // Bonus tier shown; defaults to the full set.
  const [tierCount, setTierCount] = useState<number>();
  const equippedIds = Object.values(build.slots);
  const equipped = members.filter((item) => equippedIds.includes(item.id)).length;
  const tier = set.bonuses.find((bonus) => bonus.count === tierCount) ?? set.bonuses.at(-1);
  return <article className="item-card set-card">
    <div className="item-card-head">
      <Shield size={22} />
      <div>
        <h3>{set.name}</h3>
        <small>Niv. {level} · {members.length} objets{equipped ? ` · ${equipped} équipé(s)` : ""}</small>
      </div>
    </div>
    {set.bonuses.length > 1 && <div className="set-tier-picker" role="group" aria-label="Nombre d’objets équipés">
      {set.bonuses.map((bonus) => <button key={bonus.count} className={`${bonus === tier ? "active" : ""} ${bonus.count === equipped ? "equipped" : ""}`} aria-pressed={bonus === tier} title={`Bonus avec ${bonus.count} objets`} onClick={() => setTierCount(bonus.count)}>{bonus.count}</button>)}
    </div>}
    <div className="set-members">
      {members.map((item) => <ItemHover key={item.id} item={item} catalog={catalog} request={request}>
        <button className={`set-member ${equippedIds.includes(item.id) ? "equipped" : ""}`} aria-label={item.name} onClick={() => onItem(item)}><GameImage src={item.icon} /></button>
      </ItemHover>)}
    </div>
    {!!statKeys.length && <div className="item-stats">{statKeys.map((key) => {
      const stat = catalog.stats.find((entry) => entry.key === key);
      return <div key={key} className="stat-line highlight" title="Panoplie complète, objets et bonus">
        <StatIcon stat={stat} /><span>{stat?.name || key} (complète)</span><strong>{fmt(totals[key] ?? 0)}{statUnit(stat)}</strong>
      </div>;
    })}</div>}
    {tier ? <div className="item-stats">
      {Object.entries(tier.stats).map(([key, value]) => {
        const stat = catalog.stats.find((entry) => entry.key === key);
        return <div key={key} className={`stat-line ${value < 0 ? "malus" : ""} ${statKeys.includes(key) ? "highlight" : ""}`}>
          <StatIcon stat={stat} /><span>{stat?.name || key}</span><strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
        </div>;
      })}
    </div> : <p className="character-rule">Aucun bonus de panoplie.</p>}
  </article>;
}
