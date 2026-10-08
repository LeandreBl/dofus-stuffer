import { Info } from "lucide-react";
import type { BuildEvaluation } from "@dofus/shared";

export function SpellsNotices({ evaluation }: { evaluation: BuildEvaluation }) {
  const equipped = Object.keys(evaluation.build.slots).length;
  return (
    <>
      <div className="notice page-notice">
        <Info size={16} />
        <div>
          Calcul instantané avec ton équipement actuel et les résistances de la
          cible. <strong>{equipped} objets équipés</strong>. Configure les
          états et déclenchements dans la fiche de chaque sort.
        </div>
      </div>
      {evaluation.warnings.length > 0 && (
        <div className="notice warning page-notice">
          <Info size={17} />
          <div>
            <strong>Vérifications du stuff hors combat.</strong> Les passifs
            cochés ci-dessous sont compris dans l’aperçu. Les autres effets non
            pris en charge restent signalés.
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>
                Voir les {evaluation.warnings.length} informations
              </summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {evaluation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}
      {evaluation.violations.length > 0 && equipped > 0 && (
        <div className="notice warning page-notice">
          <Info size={17} />
          <div>
            Ce stuff présente des conditions non remplies ou des objectifs
            obligatoires non atteints. Consulte les vérifications dans « Mon stuff ».
          </div>
        </div>
      )}
    </>
  );
}
