import type { Catalog, ExoStat, OptimizationRequest } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";

export function ExoFilters({ catalog, request, onChange }: {
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
}) {
  const maxExos = request.filters.maxExos ?? 2;
  return (
    <div className="fm-controls">
      <h3>Exos autorisés dans la recherche</h3>
      <div className="exo-limit-row">
        <span id="exo-limit-label">Maximum d’exos</span>
        <div className="exo-limit-options" role="group" aria-labelledby="exo-limit-label">
          {[0, 1, 2].map((maximum) => <button key={maximum} className={maxExos === maximum ? "active" : ""} aria-pressed={maxExos === maximum} aria-label={`${maximum} exo${maximum > 1 ? "s" : ""} maximum`} onClick={() => onChange({ ...request, filters: { ...request.filters, maxExos: maximum } })}>{maximum}</button>)}
        </div>
      </div>
      <div className="fm-toggles">
        {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => {
          const enabled = request.filters.allowedExos?.includes(exo) || false;
          return <button key={exo} className={`category-toggle ${enabled ? "" : "off"}`} aria-pressed={enabled} disabled={maxExos === 0} onClick={() => onChange({ ...request, filters: { ...request.filters, allowedExos: enabled ? request.filters.allowedExos?.filter((value) => value !== exo) : [...(request.filters.allowedExos || []), exo] } })}>
            <StatIcon stat={catalog.stats.find((stat) => stat.key === exo)} /> Exo {exo === "actionPoints" ? "PA" : "PM"}<span className="switch" aria-hidden="true" />
          </button>;
        })}
      </div>
      <p className="character-rule" style={{ marginTop: 9 }}>{maxExos === 0 ? "Aucun exo ne sera utilisé." : maxExos === 1 ? "Au plus un exo : le moteur choisit PA ou PM parmi les types autorisés." : "Au plus deux exos : +1 PA et +1 PM, selon les types autorisés."} Tu choisiras ensuite les objets à forgemager. Les suppléments se règlent dans Marché.</p>
    </div>
  );
}
