import { Check, Info } from "lucide-react";
import type { BuildEvaluation, Catalog, Constraint } from "@dofus/shared";
import { constraintName } from "../../../constraints/describe";
import { fmt, money } from "../../../lib/format";

export function ObjectivesPanel({ catalog, constraints, evaluation }: {
  catalog: Catalog;
  constraints: Constraint[];
  evaluation: BuildEvaluation;
}) {
  return (
    <section className="panel">
      <h3>Mes objectifs</h3>
      {constraints.length ? (
        constraints.map((criterion) => {
          const result = evaluation.constraints.find((entry) => entry.id === criterion.id);
          return (
            <div key={criterion.id} className={`constraint-check ${!result?.satisfied ? "failed" : ""}`}>
              {result?.satisfied ? <Check size={12} /> : <Info size={12} />}
              <span>{constraintName(catalog, criterion)}</span>
              <b>
                {result?.supported
                  ? criterion.kind === "price"
                    ? money(result.value)
                    : `${fmt(result.value)}${criterion.metric === "criticalChance" ? " %" : ""}`
                  : "À vérifier"}
              </b>
            </div>
          );
        })
      ) : (
        <p className="section-help">Ajoute des critères dans l’atelier.</p>
      )}
    </section>
  );
}
