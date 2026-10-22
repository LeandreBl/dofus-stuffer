import { LoaderCircle, Sparkles } from "lucide-react";
import { fmRuneWeight, type Catalog, type FmAdvice, type FmLine, type FmOdds, type FmPlanOption, type FmPolicy, type FmRune } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";

export type ForgeOutcome = "clean" | "partial" | "failure";
const pct = (value: number) => `${fmt(value * 100)} %`;
const policyText: Record<FmPolicy, string> = {
  heavy: "Ensuite : lignes lourdes d’abord.",
  "heavy-small": "Ensuite : lignes lourdes d’abord, petites runes.",
  pool: "Ensuite : petites lignes d’abord pour gagner du puits, puis la rune lourde quand le puits la couvre.",
  "pool-small": "Ensuite : petites lignes d’abord, petites runes, puis la rune lourde quand le puits la couvre.",
};

function OddsBar({ odds }: { odds: FmOdds }) {
  return (
    <div className="forge-odds" role="img" aria-label={`Succès critique ${pct(odds.clean)}, succès neutre ${pct(odds.partial)}, échec critique ${pct(odds.failure)}`}>
      <span className="clean" style={{ width: pct(odds.clean) }} />
      <span className="partial" style={{ width: pct(odds.partial) }} />
      <span className="failure" style={{ width: pct(odds.failure) }} />
    </div>
  );
}

/** The planner's best rune (the greedy one while it computes) and the runner-up options. */
export function ForgeAdvice({ catalog, advice, options, running, locked, onOutcome }: {
  catalog: Catalog;
  advice?: FmAdvice;
  options?: FmPlanOption[];
  running: boolean;
  /** The shared screen tells the outcomes: no manual input. */
  locked: boolean;
  onOutcome: (rune: FmRune, line: FmLine, outcome: ForgeOutcome) => void;
}) {
  const best = options?.[0];
  const shown = best ?? advice;
  const name = (line: FmLine) => catalog.stats.find((entry) => entry.key === line.stat)?.name || line.stat;
  if (!shown) return (
    <section className="panel forge-advice">
      <div className="panel-head"><div><h2><Sparkles size={17} /> Prochaine rune</h2><p>Objectif atteint, ou aucune rune n’existe pour les lignes restantes.</p></div></div>
    </section>
  );
  const { line, rune, odds } = shown;
  return (
    <section className="panel forge-advice">
      <div className="panel-head">
        <div><h2><Sparkles size={17} /> Prochaine rune</h2><p>Chaque rune possible est simulée jusqu’au bout de la session, avec les pertes et le puits.</p></div>
        {running && <LoaderCircle className="forge-spin" size={16} aria-label="Calcul en cours" />}
      </div>
      <div className="forge-rune">
        <StatIcon stat={catalog.stats.find((entry) => entry.key === line.stat)} />
        <div><strong>Rune {rune.name}</strong><small>+{rune.points} {name(line)} · poids {fmt(fmRuneWeight(rune))}</small></div>
      </div>
      {best && (
        <p className="forge-plan-score">
          <strong>{pct(best.success)}</strong> de chances d’atteindre l’objectif
          {Number.isFinite(best.runes) && <> · ~{fmt(Math.round(best.runes))} runes</>}
          <small>Sur {best.rollouts} sessions simulées. {policyText[best.policy]}</small>
        </p>
      )}
      <OddsBar odds={odds} />
      <div className="forge-odds-legend">
        <span className="clean">SC {pct(odds.clean)}</span><span className="partial">SN {pct(odds.partial)}</span><span className="failure">EC {pct(odds.failure)}</span>
      </div>
      <p className="inline-notice">{locked ? "Résultat lu sur l’écran partagé." : "Résultat en jeu, si tu ne lis pas l’écran :"}</p>
      <div className="forge-outcomes">
        <button className="button small clean" disabled={locked} onClick={() => onOutcome(rune, line, "clean")}>Succès critique</button>
        <button className="button small partial" disabled={locked} onClick={() => onOutcome(rune, line, "partial")}>Succès neutre</button>
        <button className="button small failure" disabled={locked} onClick={() => onOutcome(rune, line, "failure")}>Échec critique</button>
      </div>
      {options && options.length > 1 && (
        <table className="forge-table forge-runes">
          <thead><tr><th>Autres choix</th><th>Réussite</th><th>Runes</th></tr></thead>
          <tbody>
            {options.slice(1, 7).map((option) => (
              <tr key={option.rune.id}>
                <td>{option.rune.name}</td>
                <td>{pct(option.success)}</td>
                <td>{Number.isFinite(option.runes) ? `~${fmt(Math.round(option.runes))}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
