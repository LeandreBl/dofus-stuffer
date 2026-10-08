import type { BuildEvaluation, Catalog } from "@dofus/shared";
import { fmt } from "../../../lib/format";

export function ActiveSetsPanel({ catalog, evaluation }: { catalog: Catalog; evaluation: BuildEvaluation }) {
  return (
    <section className="panel">
      <h3>Bonus de panoplies</h3>
      <p className="character-rule" style={{ marginBottom: 12 }}>{fmt(evaluation.stats.activeSetCount || 0)} panoplie(s) active(s). Une panoplie est comptée dès 2 objets équipés. Pour « bonus pano &lt; 2 », une seule panoplie peut être active.</p>
      {evaluation.sets.length ? (
        evaluation.sets.map((set) => (
          <div className="set-bonus" key={set.id}>
            <strong>
              {set.name} <small>({set.count} objets)</small>
            </strong>
            {Object.entries(set.stats).map(([key, value]) => (
              <div key={key}>
                +{fmt(value)} {catalog.stats.find((stat) => stat.key === key)?.name || key}
              </div>
            ))}
          </div>
        ))
      ) : (
        <p className="section-help">
          Équipe plusieurs objets d’une même panoplie pour activer ses
          bonus.
        </p>
      )}
    </section>
  );
}
