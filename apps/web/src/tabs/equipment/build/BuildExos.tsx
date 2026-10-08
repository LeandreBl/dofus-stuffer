import { AlertTriangle, Check, Plus } from "lucide-react";
import type { BuildEvaluation, Catalog, ExoStat, inspectEquipment } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

const statusLabels = { active: "Actif · retirer", possible: "Ajouter", blocked: "À vérifier", noGain: "Sans gain" };

/** +1 PA / +1 PM exotic toggles on the current build. */
export function BuildExos({ catalog, evaluation, diagnostics, maxExos, onExo }: {
  catalog: Catalog;
  evaluation: BuildEvaluation;
  diagnostics: ReturnType<typeof inspectEquipment>;
  maxExos: number;
  onExo: (exo: ExoStat, enabled: boolean) => void;
}) {
  const exoCount = new Set(evaluation.build.exoBonuses || []).size;
  return (
    <>
      <div className="build-exos">
        {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => {
          const enabled = evaluation.build.exoBonuses?.includes(exo) || false;
          const diagnostic = diagnostics.exos[exo];
          const warning = !enabled && diagnostic.status === "blocked";
          const statusLabel = statusLabels[diagnostic.status];
          const unit = exo === "actionPoints" ? "PA" : "PM";
          return <div className={`build-exo-option ${diagnostic.status}`} key={exo}>
            <button className={`build-exo ${enabled ? "active" : ""}`} aria-pressed={enabled} aria-describedby={`exo-${exo}-reason`} aria-label={`+1 ${unit} exotique sur le stuff · ${statusLabel}`} onClick={() => onExo(exo, !enabled)}>
              <StatIcon stat={catalog.stats.find((stat) => stat.key === exo)} /><span>+1 {unit} exotique<small>{statusLabel}</small></span>{enabled ? <Check size={14} /> : warning ? <AlertTriangle size={14} /> : <Plus size={14} />}
            </button>
            <p id={`exo-${exo}-reason`} className="build-exo-reason">{diagnostic.reasons[0] || (enabled ? "Objet au choix. Clique pour retirer cet exo." : `${fmt(diagnostic.before)} → ${fmt(diagnostic.after)} ${unit} · Objet au choix.`)}</p>
            {diagnostic.reasons.length > 1 && <details className="build-exo-more"><summary>Autres raisons ({diagnostic.reasons.length - 1})</summary><ul>{diagnostic.reasons.slice(1).map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>}
          </div>;
        })}
      </div>
      <p className="build-exo-limit">{exoCount} exo{exoCount > 1 ? "s" : ""} actif{exoCount > 1 ? "s" : ""} · Modification libre<br />Recherche : {maxExos} exo{maxExos > 1 ? "s" : ""} maximum, selon l’atelier</p>
    </>
  );
}
