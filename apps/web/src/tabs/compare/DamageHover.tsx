import type { HTMLAttributes, ReactElement } from "react";
import type { Catalog, DamageRange } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { HoverCard } from "../../components/HoverCard";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";
import { rangeLabel } from "../spells/damage";

export interface DamageDetail { normal: DamageRange; critical: DamageRange | null; chance: number | null; criticalShown: boolean }

/** Normal and critical hits of one card row, in the same card style as the spell and item previews. */
export function DamageHover({ catalog, title, subtitle, icon, detail, children }: {
  catalog: Catalog; title: string; subtitle: string; icon?: string; detail: DamageDetail;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const stat = (key: string) => catalog.stats.find((entry) => entry.key === key);
  const row = (label: string, iconKey: string, range: DamageRange | null, shown: boolean) => (
    <div className={`damage-hover-row ${shown ? "shown" : ""}`}>
      <StatIcon stat={stat(iconKey)} />
      <span>{label}{shown && <small>affiché</small>}</span>
      {range ? <strong>{fmt(range.average)}<small>{rangeLabel(range)}</small></strong> : <strong className="none">Aucun</strong>}
    </div>
  );
  return (
    <HoverCard label={`Dégâts de ${title}`} content={
      <>
        <div className="item-hover-heading damage-hover-heading">
          {icon && <GameImage src={icon} />}
          <div><h3>{title}</h3><p>{subtitle}</p></div>
        </div>
        <div className="damage-hover-rows">
          {row("Coup normal", "dealtDamageMultiplierSpells", detail.normal, !detail.criticalShown)}
          {row("Coup critique", "criticalHit", detail.critical, detail.criticalShown)}
        </div>
        {detail.chance !== null && <footer><span>Chance de critique</span><strong>{fmt(detail.chance)} %</strong></footer>}
      </>
    }>{children}</HoverCard>
  );
}
