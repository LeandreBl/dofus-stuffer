import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { evaluateBuild, inspectEquipment, type Build, type Catalog, type EquipmentItem, type OptimizationRequest, type Slot } from "@dofus/shared";
import { manualBuildRequest } from "../lib/build-preview";
import { ConditionStatus } from "./ConditionStatus";

/** Equipment conditions of an item, checked as if it were equipped in the preview slot. */
export function ItemConditions({ item, catalog, request, build, previewSlot, equipped }: {
  item: EquipmentItem;
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  previewSlot: Slot;
  equipped: boolean;
}) {
  const inspection = useMemo(() => {
    const preview = { ...build, slots: { ...build.slots, [previewSlot]: item.id } };
    const previewRequest = manualBuildRequest(request);
    return inspectEquipment(catalog, previewRequest, evaluateBuild(catalog, previewRequest, preview));
  }, [catalog, request, build, previewSlot, item.id]);
  const itemDiagnostic = inspection.items[previewSlot];
  const candidateIssues = inspection.issues.filter((issue) => issue.slots.includes(previewSlot));
  if (!itemDiagnostic?.condition && !candidateIssues.length && !item.conditionsText) return null;
  return (
    <section className="item-compatibility">
      <h4>Conditions d’équipement</h4>
      <p className="section-help">{equipped ? "Vérifiées avec ton stuff actuel, exos compris." : "Aperçu si tu équipes cet objet à la place de l’emplacement choisi, exos compris."}</p>
      {itemDiagnostic?.condition ? <ConditionStatus condition={itemDiagnostic.condition} /> : item.conditionsText && <div className="notice warning"><Info size={15} /><div>Une condition particulière de cet objet n’est pas encore interprétée. Vérifie ses prérequis en jeu.</div></div>}
      {candidateIssues.length > 0 && <div className="item-compatibility-issues">{candidateIssues.map((issue, index) => <div className={`notice ${issue.severity === "error" ? "error" : "warning"}`} key={`${issue.code}-${index}`}><AlertTriangle size={14} /><div>{issue.message}</div></div>)}</div>}
    </section>
  );
}
