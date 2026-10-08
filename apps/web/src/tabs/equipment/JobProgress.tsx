import { Check, Info, LoaderCircle, RotateCcw, Square } from "lucide-react";
import type { JobSnapshot, QueueStatus } from "@dofus/shared";
import { fmt } from "../../lib/format";

export const statusTitles: Record<JobSnapshot["status"], string> = {
  queued: "Ta recherche attend son tour",
  running: "On explore les combinaisons",
  completed: "Recherche terminée",
  cancelled: "Recherche arrêtée",
  failed: "La recherche a rencontré un problème",
};

export function JobProgress({ job, queue, active, connected, starting, onCancel, onRestart }: {
  job: JobSnapshot;
  queue: QueueStatus | null;
  active: boolean;
  connected: boolean;
  starting: boolean;
  onCancel: () => void;
  onRestart: () => void;
}) {
  return (
    <section className={`progress-dock ${job.error ? "open" : ""}`} aria-live="polite" tabIndex={0}>
      <div className="panel progress-card">
        <div className="progress-head">
          <h3>
            {active ? <LoaderCircle className="spin" size={18} /> : job.status === "failed" ? <Info size={18} /> : <Check size={18} />}
            {statusTitles[job.status] ?? statusTitles.failed}
          </h3>
          {active ? (
            <button className="button small ghost" onClick={onCancel}>
              <Square size={11} /> Arrêter
            </button>
          ) : (
            <button className="button small ghost" onClick={onRestart} disabled={starting}>
              <RotateCcw size={12} /> Relancer
            </button>
          )}
        </div>
        <div className="progress-meta">
          <span>
            {fmt(job.progress.evaluated)} combinaisons ·{" "}
            {fmt(job.progress.feasible)} valides
          </span>
          <span>
            {fmt(Math.floor(job.progress.elapsedMs / 1000))} s
            {active && (connected ? " · En direct" : " · Actualisation automatique")}
          </span>
        </div>
        {job.status === "queued" && queue && (
          <p className="progress-meta">
            <span>
              {queue.ahead === null ? "Démarrage imminent" : queue.ahead === 0 ? "Prochaine dans la file" : `${fmt(queue.ahead)} recherche(s) avant la tienne`}
              {" · "}{fmt(queue.waiting)} en attente
            </span>
            <span>{queue.paused && "File en pause · "}{fmt(queue.active)} en cours · {fmt(queue.workers)} moteur(s)</span>
          </p>
        )}
        {job.message && <p className="inline-notice">{job.message}</p>}
        {job.error && (
          <p className="inline-notice" role="alert">
            {job.error}
          </p>
        )}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, job.progress.percent))}%` }} />
      </div>
    </section>
  );
}
