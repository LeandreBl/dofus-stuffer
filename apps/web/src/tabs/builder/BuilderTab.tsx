import type { Dispatch, SetStateAction } from "react";
import { Info } from "lucide-react";
import type { Build, BuildEvaluation, Catalog, Constraint, OptimizationRequest } from "@dofus/shared";
import { CharacterPanel } from "./character/CharacterPanel";
import { CriteriaCatalog } from "./criteria/CriteriaCatalog";
import { EquipmentFilters } from "./filters/EquipmentFilters";
import { LaunchPanel } from "./LaunchPanel";
import { Priorities } from "./Priorities";

export function BuilderTab({ catalog, request, build, evaluation, saved, searching, onChange, onServer, onAdd, onEdit, onBrowse, onFollow }: {
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  evaluation: BuildEvaluation;
  saved: boolean;
  searching: boolean;
  onChange: Dispatch<SetStateAction<OptimizationRequest>>;
  onServer: (server: string) => void;
  onAdd: (criterion: Constraint) => void;
  onEdit: (criterion: Constraint) => void;
  onBrowse: () => void;
  onFollow: () => void;
}) {
  return (
    <div className="builder-grid">
      <div className="builder-main">
        <CharacterPanel catalog={catalog} request={request} build={build} onChange={onChange} onServer={onServer} />
        <CriteriaCatalog
          catalog={catalog}
          request={request}
          weapon={catalog.items.find((item) => item.id === build.slots.weapon)}
          onAdd={onAdd}
          onEdit={onEdit}
        />
        <EquipmentFilters catalog={catalog} request={request} onChange={onChange} onBrowse={onBrowse} />
      </div>
      <aside className="builder-side">
        <Priorities
          catalog={catalog}
          constraints={request.constraints}
          onChange={(constraints) => onChange((previous) => ({ ...previous, constraints }))}
          onEdit={onEdit}
          saved={saved}
          evaluation={evaluation}
        />
        <LaunchPanel
          seconds={request.seconds}
          searching={searching}
          onSeconds={(seconds) => onChange((previous) => ({ ...previous, seconds }))}
          onFollow={onFollow}
        />
        <div className="summary-note">
          <Info size={17} />
          <p>
            <strong>Ton ordre, tes choix.</strong>
            <br />
            Une cible obligatoire doit être respectée. Pour le reste, le
            moteur cherche le meilleur compromis selon tes priorités et limite les malus, même sur les caractéristiques sans objectif.
          </p>
        </div>
      </aside>
    </div>
  );
}
