import { Info } from "lucide-react";
import type { BuildEvaluation } from "@dofus/shared";

/** Rules the build breaks, then every check and limit of the evaluation. */
export function BuildChecks({ evaluation, equipped }: { evaluation: BuildEvaluation; equipped: boolean }) {
  const checks = [...evaluation.violations, ...evaluation.warnings];
  return (
    <>
      {!evaluation.valid && <div className="notice warning build-legality" style={{ marginTop: 18 }} role="status">
        <Info size={17} /><div><strong>Ce stuff ne respecte pas encore toutes les règles.</strong><ul>{evaluation.violations.map((violation, index) => <li key={index}>{violation}</li>)}</ul></div>
      </div>}
      {checks.length > 0 && equipped && (
        <details className="panel" style={{ marginTop: 23 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#bdcba8" }}>
            Vérifications et limites du stuff ({checks.length})
          </summary>
          <ul className="section-help" style={{ marginTop: 15 }}>
            {checks.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}
