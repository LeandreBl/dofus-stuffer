import type { Catalog, ExoStat, inspectEquipment } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

/** AP / MP effective value against the game cap and the equipment or objective maximums. */
export function MobilityLimits({ catalog, limits }: {
  catalog: Catalog;
  limits: ReturnType<typeof inspectEquipment>["limits"];
}) {
  return (
    <div className="equipment-limits">
      {(["actionPoints", "movementPoints"] as ExoStat[]).map((key) => {
        const limit = limits[key];
        const unit = key === "actionPoints" ? "PA" : "PM";
        return <div className="equipment-limit" key={key}>
          <div className="equipment-limit-heading"><StatIcon stat={catalog.stats.find((stat) => stat.key === key)} /><strong>{fmt(limit.effective)} {unit}</strong>{limit.raw !== limit.effective && <small>{fmt(limit.raw)} équipés</small>}</div>
          <dl>
            <div><dt>Plafond du jeu</dt><dd>{limit.cap} {unit}</dd></div>
            {limit.equipmentMaximum !== null && <div className={limit.raw > limit.equipmentMaximum ? "failed" : ""}><dt>Maximum avec ces objets</dt><dd>{fmt(limit.equipmentMaximum)} {unit}</dd></div>}
            {limit.strictMaximum !== null && <div className={limit.effective > limit.strictMaximum ? "failed" : ""}><dt>Ton maximum obligatoire</dt><dd>{fmt(limit.strictMaximum)} {unit}</dd></div>}
          </dl>
        </div>;
      })}
    </div>
  );
}
