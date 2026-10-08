import { Coins, Plus } from "lucide-react";
import type { Constraint } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { uid } from "../../../lib/format";

export function PriceCriteria({ constraints, onAdd, onEdit }: {
  constraints: Constraint[];
  onAdd: (criterion: Constraint) => void;
  onEdit: (criterion: Constraint) => void;
}) {
  return (
    <div style={{ paddingTop: 22 }}>
      <div className="notice">
        <Coins size={18} />
        <div>
          Le prix est une priorité comme les autres. Fixe un plafond, ou
          demande simplement le stuff le moins cher. Les prix sont propres
          au serveur sélectionné.
        </div>
      </div>
      <button
        className="stat-tile"
        style={{ width: "100%", marginTop: 17 }}
        onClick={() => {
          const old = constraints.find((entry) => entry.kind === "price");
          if (old) onEdit(old);
          else onAdd({ id: uid(), kind: "price", target: 20_000_000, relation: "atMost", priority: 0, strict: false });
        }}
      >
        <StatIcon price />
        <span>Budget du stuff</span>
        <Plus size={15} />
      </button>
      <p className="inline-notice">
        Un prix manquant n’est jamais compté comme zéro. Renseigne tes prix
        dans l’onglet Marché.
      </p>
    </div>
  );
}
