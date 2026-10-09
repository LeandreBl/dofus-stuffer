import { useState } from "react";
import { api, type CheckReport, type Overview } from "../api";
import { Button, formatDate, Panel, Tag } from "../ui";

const CHECK_TONE: Record<string, "sage" | "accent" | "neutral"> = { updated: "sage", unchanged: "neutral", older: "neutral", error: "accent", unconfigured: "neutral" };
const CHECK_LABEL: Record<string, string> = { updated: "Mis à jour", unchanged: "Inchangé", older: "Source plus ancienne", error: "Erreur", unconfigured: "Non configuré" };

export function Manage({ overview, onChange, onError }: { overview: Overview; onChange: () => void; onError: (error: unknown) => void }) {
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const { maintenance } = overview;

  const run = async (key: string, path: string, done: string) => {
    setBusy(key);
    try { await api(path, "POST"); setNotice(done); onChange(); } catch (error) { onError(error); } finally { setBusy(undefined); }
  };

  return (
    <div className="page">
      {notice ? <div className="card notice" role="status">{notice}</div> : null}
      <div className="panel-grid">
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
