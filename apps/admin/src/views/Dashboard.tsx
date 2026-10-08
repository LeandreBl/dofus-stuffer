import type { Overview } from "../api";
import { formatDuration, formatNumber, InsetTile, Meter, OutcomeChart, Panel, StatCard, Tag } from "../ui";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const percent = (part: number, whole: number) => whole ? (part / whole) * 100 : 0;

export function Dashboard({ overview }: { overview: Overview }) {
  const { counts, stats } = overview;
  const today = stats.at(-1)!, week = stats.slice(-7);
  const total = (field: "created" | "completed" | "cancelled" | "failed" | "computeMs" | "evaluated", days = stats) => sum(days.map(day => day[field]));
  const finished = total("completed") + total("cancelled") + total("failed");
  const waiting = counts.waiting + counts.prioritized + counts.delayed + counts.paused;

  return (
    <div className="page">
      <div className="auto-grid">
        <StatCard kicker="En cours" value={counts.active} delta={`${overview.workers} moteur${overview.workers > 1 ? "s" : ""}`}
          tone={overview.workers ? "sage" : "accent"} meta="Recherches en train de tourner" />
        <StatCard kicker="En attente" value={waiting} delta={overview.paused ? "File en pause" : undefined}
          meta="Dans la file BullMQ" />
        <StatCard kicker="Lancées aujourd’hui" value={today.created} delta={`${total("created", week)} sur 7 j`}
          tone="sage" meta="Jour UTC" />
        <StatCard kicker="Annulées aujourd’hui" value={today.cancelled}
          delta={`${Math.round(percent(total("cancelled"), finished))} % sur 30 j`} tone="neutral" meta={`${today.failed} échec(s) aujourd’hui`} />
      </div>

      <div className="panel-grid">
        <Panel title="Issues des recherches" eyebrow="30 derniers jours">
          <OutcomeChart days={stats.map(day => ({ ...day, label: day.day.slice(5).split("-").reverse().join("/") }))} />
        </Panel>

        <Panel title="Répartition" eyebrow={`${formatNumber(finished)} recherches terminées`}>
          {([["Terminées", "completed", "sage"], ["Annulées", "cancelled", "neutral"], ["Échouées", "failed", "accent"]] as const).map(([label, field, tone]) => (
            <div key={field} className="meter-row">
              <div className="row between"><span>{label}</span><span className="text-muted">{formatNumber(total(field))} · {Math.round(percent(total(field), finished))} %</span></div>
              <Meter value={percent(total(field), finished)} tone={tone} />
            </div>
          ))}
          <div className="tiles">
            <InsetTile label="Calcul moyen" value={finished ? formatDuration(total("computeMs") / finished) : "—"} />
            <InsetTile label="Combinaisons / recherche" value={finished ? formatNumber(Math.round(total("evaluated") / finished)) : "—"} />
          </div>
        </Panel>
      </div>

      <div className="panel-grid">
        <Panel title="Santé" eyebrow="Temps réel">
          <div className="tiles">
            <InsetTile label="Redis" value={overview.redis ? <Tag tone="sage">OK</Tag> : <Tag tone="accent">Hors ligne</Tag>} />
            <InsetTile label="Moteurs" value={overview.workers} />
            <InsetTile label="File" value={overview.paused ? <Tag tone="accent">En pause</Tag> : <Tag tone="sage">Active</Tag>} />
            <InsetTile label="Échecs retenus" value={counts.failed} />
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
