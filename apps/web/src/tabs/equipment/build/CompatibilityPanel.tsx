import { AlertTriangle, ArrowUpRight, Check, ChevronRight, Info, Shield } from "lucide-react";
import type { Build, Catalog, ConditionDiagnostic, EquipmentItem, inspectEquipment, Slot } from "@dofus/shared";
import { slotNames } from "../../../items/slots";
import { MobilityLimits } from "./MobilityLimits";

function conditionMentionsMobility(condition: ConditionDiagnostic): boolean {
  return condition.stat === "actionPoints" || condition.stat === "movementPoints" || Boolean(condition.children?.some(conditionMentionsMobility));
}

export function CompatibilityPanel({ catalog, build, diagnostics, onSlot }: {
  catalog: Catalog;
  build: Build;
  diagnostics: ReturnType<typeof inspectEquipment>;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
}) {
  const mobilityConditions = Object.values(diagnostics.items).filter((item) => item?.condition && conditionMentionsMobility(item.condition));
  return (
    <section className="panel equipment-compatibility">
      <h3><Shield size={14} /> Compatibilité du stuff</h3>
      <MobilityLimits catalog={catalog} limits={diagnostics.limits} />
      {mobilityConditions.length > 0 && <div className="equipment-mobility-conditions">
        <h4>Conditions PA / PM des objets</h4>
        {mobilityConditions.map((entry) => {
          if (!entry?.condition) return null;
          const item = catalog.items.find((candidate) => candidate.id === entry.itemId);
          return <button key={entry.slot} className={`equipment-rule ${entry.condition.satisfied === false ? "failed" : entry.condition.satisfied === null ? "unverified" : ""}`} onClick={() => onSlot(entry.slot, item)}>
            {entry.condition.satisfied === true ? <Check size={12} /> : <Info size={12} />}<span><strong>{item?.name || slotNames[entry.slot]}</strong>{entry.condition.text}</span><ChevronRight size={12} />
          </button>;
        })}
      </div>}
      {diagnostics.issues.length > 0 ? <div className="equipment-issues">{diagnostics.issues.map((issue, index) => <div className={`equipment-issue ${issue.severity}`} key={`${issue.code}-${index}`}><AlertTriangle size={13} /><div><p>{issue.message}</p>{issue.slots.length > 0 && <div className="equipment-issue-links">{issue.slots.map((slot) => {
        const item = catalog.items.find((entry) => entry.id === build.slots[slot]);
        return item && <button key={slot} onClick={() => onSlot(slot, item)}>{item.name}<ArrowUpRight size={10} /></button>;
      })}</div>}</div></div>)}</div> : <p className="equipment-compatible"><Check size={12} /> Conditions d’équipement respectées.</p>}
      <p className="section-help equipment-limit-note">Limites pour tes caractéristiques actuelles. Les conditions des objets utilisent les totaux équipés avant les plafonds du jeu, exos compris.</p>
    </section>
  );
}
