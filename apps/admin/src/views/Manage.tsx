import { useState } from "react";
import { api, type CheckReport, type Overview } from "../api";
import { Button, formatDate, Panel, Tag } from "../ui";

const CHECK_TONE: Record<string, "sage" | "accent" | "neutral"> = { updated: "sage", unchanged: "neutral", older: "neutral", error: "accent", unconfigured: "neutral" };
const CHECK_LABEL: Record<string, string> = { updated: "Mis à jour", unchanged: "Inchangé", older: "Source plus ancienne", error: "Erreur", unconfigured: "Non configuré" };

export function Manage({ overview, onChange, onError }: { overview: Overview; onChange: () => void; onError: (error: unknown) => void }) {
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const { maintenance } = overview;

  const run = async (key: string, path: string, done: string, question?: string) => {
    if (question && !confirm(question)) return;
    setBusy(key);
    try { await api(path, "POST"); setNotice(done); onChange(); } catch (error) { onError(error); } finally { setBusy(undefined); }
  };

  return (
    <div className="page">
      {notice ? <div className="card notice" role="status">{notice}</div> : null}
      <div className="panel-grid">
        <Panel title="File de recherche" eyebrow={overview.paused ? "En pause" : "Active"}
          action={<Tag tone={overview.paused ? "accent" : "sage"}>{overview.paused ? "Pause" : "Active"}</Tag>}>
          <p className="text-muted">
            La pause empêche les moteurs de démarrer de nouvelles recherches. Les recherches en cours se terminent ;
            les nouvelles s’accumulent dans la file (100 max) jusqu’à la reprise.
          </p>
          <div className="row">
            {overview.paused
              ? <Button variant="primary" loading={busy === "resume"} onClick={() => void run("resume", "queue/resume", "File reprise.")}>Reprendre la file</Button>
              : <Button variant="danger" loading={busy === "pause"} onClick={() => void run("pause", "queue/pause", "File mise en pause.", "Mettre la file en pause ? Aucune nouvelle recherche ne démarrera.")}>Mettre en pause</Button>}
          </div>
        </Panel>

        <Panel title="Maintenance des données" eyebrow={maintenance.running ? "En cours…" : `Planifiée : ${maintenance.cron} (${maintenance.timezone})`}>
          <p className="text-muted">
            Vérifie le catalogue, les prix et les notes de patch. Dernière exécution : {formatDate(maintenance.completedAt || maintenance.startedAt)}.
          </p>
          <div className="row">
            <Button variant="primary" loading={busy === "maintenance" || maintenance.running} onClick={() => void run("maintenance", "maintenance/run", "Maintenance mise en file : le service maintenance va la lancer.")}>
              Lancer maintenant
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Dernières vérifications" eyebrow={maintenance.message}>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Source</th><th>Résultat</th><th>Version</th><th>Vérifiée</th><th>Message</th></tr></thead>
            <tbody>
              {(["catalog", "prices", "patch"] as const).map(name => {
                const check: CheckReport | undefined = maintenance[name];
                return (
                  <tr key={name}>
                    <td>{{ catalog: "Catalogue", prices: "Prix", patch: "Notes de patch" }[name]}</td>
                    <td>{check ? <Tag tone={CHECK_TONE[check.status] || "neutral"}>{CHECK_LABEL[check.status] || check.status}</Tag> : "—"}</td>
                    <td>{check?.sourceVersion || "—"}</td>
                    <td className="nowrap">{formatDate(check?.checkedAt)}</td>
                    <td className="message">{check?.message || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {maintenance.latestPatch ? (
          <p className="card-meta">Dernière note : <a href={maintenance.latestPatch.url} target="_blank" rel="noreferrer">{maintenance.latestPatch.title}</a> · {formatDate(maintenance.latestPatch.publishedAt)}</p>
        ) : null}
      </Panel>
    </div>
  );
}
