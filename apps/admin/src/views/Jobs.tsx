import { useState } from "react";
import { api, type AdminJob } from "../api";
import { Button, formatDate, formatDuration, formatNumber, Meter, Panel, Seg, StatusTag, usePolling } from "../ui";

type State = "live" | "completed" | "failed";

export function Jobs({ search, onError }: { search: string; onError: (error: unknown) => void }) {
  const [state, setState] = useState<State>("live");
  const [busy, setBusy] = useState<string>();
  const jobs = usePolling(() => api<AdminJob[]>(`jobs?state=${state}`), 3_000, [state]);
  const query = search.trim().toLowerCase();
  const rows = (jobs.data || []).filter(job => !query || `${job.id} ${job.className} ${job.message || ""}`.toLowerCase().includes(query));

  const cancel = async (id: string) => {
    if (!confirm("Arrêter cette recherche ? Les résultats déjà trouvés restent disponibles pour l’utilisateur.")) return;
    setBusy(id);
    try { await api(`jobs/${id}/cancel`, "POST"); jobs.refresh(); } catch (error) { onError(error); } finally { setBusy(undefined); }
  };

  return (
    <div className="page">
      <Panel title="Recherches" eyebrow={jobs.data ? `${rows.length} affichée(s) · 100 max` : "Chargement…"}
        action={<Seg label="État" value={state} onChange={setState}
          options={[{ value: "live", label: "En cours" }, { value: "completed", label: "Terminées" }, { value: "failed", label: "Échouées" }]} />}>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>État</th><th>Personnage</th><th>Durée</th><th>Progression</th><th>Combinaisons</th><th>Stuffs</th><th>Créée</th><th>Message</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(job => {
                const live = job.status === "queued" || job.status === "running";
                return (
                  <tr key={job.id}>
                    <td><StatusTag status={job.status} /></td>
                    <td><div>{job.className} {job.level ? `· niv. ${job.level}` : ""}</div><div className="eyebrow text-muted" title={job.id}>{job.id.slice(0, 8)} · {job.constraints} contrainte(s)</div></td>
                    <td className="nowrap">{job.progress ? formatDuration(job.progress.elapsedMs) : "—"} / {job.seconds ?? "?"} s</td>
                    <td className="progress-cell">{job.progress ? <><Meter value={job.progress.percent} tone={live ? "accent" : "sage"} /><span className="eyebrow text-muted">{Math.round(job.progress.percent)} %</span></> : "—"}</td>
                    <td>{job.progress ? formatNumber(job.progress.evaluated) : "—"}</td>
                    <td>{job.results}</td>
                    <td className="nowrap">{formatDate(job.createdAt)}</td>
                    <td className="message">{job.message}</td>
                    <td>{live ? <Button className="btn-sm" variant="danger" loading={busy === job.id} onClick={() => void cancel(job.id)}>Arrêter</Button> : null}</td>
                  </tr>
                );
              })}
              {jobs.data && !rows.length ? <tr><td colSpan={9} className="text-muted empty">Aucune recherche.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
