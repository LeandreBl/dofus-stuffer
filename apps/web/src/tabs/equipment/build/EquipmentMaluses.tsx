import { AlertTriangle } from "lucide-react";
import type { Catalog, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt, statUnit } from "../../../lib/format";

export function EquipmentMaluses({ catalog, maluses }: { catalog: Catalog; maluses: Stats }) {
  return (
    <details className="equipment-maluses">
      <summary><AlertTriangle size={14} /> Malus du stuff</summary>
      <p>Ces pertes ne pénalisent le classement que via tes objectifs. Les bonus des autres objets restent inclus dans les totaux affichés.</p>
      <div className="malus-stats">{Object.entries(maluses).map(([key, value]) => {
        const stat = catalog.stats.find((entry) => entry.key === key);
        return <span key={key}>
          <StatIcon stat={stat} /><span>{stat?.name || key}</span><strong>{fmt(value)}{statUnit(stat)}</strong>
        </span>;
      })}</div>
    </details>
  );
}
