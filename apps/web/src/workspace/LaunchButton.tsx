import type { CSSProperties } from "react";
import type { JobSnapshot } from "@dofus/shared";
import { fmt } from "../lib/format";
import { ArrowRight, LoaderCircle, Square, WandSparkles } from "lucide-react";

export function LaunchButton({ starting, active, disabled, withBase, percent, job, statusTitles, onLaunch, onCancel }: {
  starting: boolean;
  active: boolean;
  disabled: boolean;
  /** Some items are locked: the search restarts from them. */
  withBase: boolean;
  /** Progress of the running search, filled into the button. */
  percent?: number;
  /** Latest search, detailed on hover. */
  job: JobSnapshot | null;
  statusTitles: Record<JobSnapshot["status"], string>;
  onLaunch: () => void;
  onCancel: () => void;
}) {
  const busy = starting || active;
  return (
    <>
      <button
        className={`button primary launch-button${active ? " running" : ""}`}
        disabled={starting || (!active && disabled)}
        onClick={active ? onCancel : onLaunch}
        style={percent === undefined ? undefined : { "--progress": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}
      >
        {starting ? <LoaderCircle className="spin" size={18} /> : active ? <Square size={14} /> : <WandSparkles size={18} />}
        {starting
          ? "Démarrage…"
          : active
            ? "Arrêter la recherche"
            : withBase
              ? "Relancer avec ma base"
              : "Trouver mon stuff"}
        {!busy && <ArrowRight size={16} />}
      </button>
      {job && (
        <div className="launch-info panel" role="tooltip">
          <strong>{statusTitles[job.status]}</strong>
          <dl>
            {job.progress.rounds !== undefined && <><dt>Cycles</dt><dd>{fmt(job.progress.rounds)}{job.progress.islands ? ` × ${job.progress.islands} recherches parallèles` : ""}</dd></>}
            <dt>Combinaisons</dt><dd>{fmt(job.progress.evaluated)}</dd>
            <dt>Valides</dt><dd>{fmt(job.progress.feasible)}</dd>
            <dt>Meilleur score</dt><dd>{job.progress.bestScore === null ? "—" : fmt(job.progress.bestScore)}</dd>
            <dt>Temps</dt><dd>{fmt(Math.floor(job.progress.elapsedMs / 1000))} s · {fmt(job.progress.percent)} %</dd>
          </dl>
          {job.error && <p className="inline-notice">{job.error}</p>}
        </div>
      )}
    </>
  );
}
