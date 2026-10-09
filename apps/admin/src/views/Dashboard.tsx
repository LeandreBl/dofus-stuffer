import type { Overview } from "../api";
import { formatNumber, InsetTile, Panel, Tag } from "../ui";

export function Dashboard({ overview }: { overview: Overview }) {
  return (
    <div className="page">
      <div className="panel-grid">
        <Panel title="Santé" eyebrow="Temps réel">
          <div className="tiles">
            <InsetTile label="Redis" value={overview.redis ? <Tag tone="sage">OK</Tag> : <Tag tone="accent">Hors ligne</Tag>} />
            <InsetTile label="Maintenance" value={overview.maintenance.running ? <Tag tone="accent">En cours</Tag> : <Tag tone="sage">Au repos</Tag>} />
          </div>
        </Panel>
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
