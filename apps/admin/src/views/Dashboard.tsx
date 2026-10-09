import type { Overview } from "../api";
import { formatNumber, InsetTile, Panel } from "../ui";

export function Dashboard({ overview }: { overview: Overview }) {
  return (
    <div className="page">
      <div className="panel-grid">
        <Panel title="Catalogue" eyebrow={`Version ${overview.catalog.version}`}>
          <div className="tiles">
            <InsetTile label="Équipements" value={formatNumber(overview.catalog.items)} />
            <InsetTile label="Sorts" value={formatNumber(overview.catalog.spells)} />
            <InsetTile label="Classes" value={overview.catalog.classes} />
            <InsetTile label="Serveurs" value={overview.catalog.servers} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
