import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { JobStatus } from "./api";

/* Thin wrappers over the Organic classes, ported from the maladie-masters panel. */

export function Panel({ title, eyebrow, action, children }: { title?: ReactNode; eyebrow?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card panel">
      {title || eyebrow || action ? (
        <div className="panel-head">
          {title ? <h5>{title}</h5> : null}
          {eyebrow ? <span className="eyebrow text-muted">{eyebrow}</span> : null}
          {action ? <div className="push">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function StatCard({ kicker, value, delta, tone = "accent", meta }: { kicker: ReactNode; value: ReactNode; delta?: ReactNode; tone?: Tone; meta?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-kicker">{kicker}</div>
      <div className="row">
        <span className="num stat-value">{value}</span>
        {delta ? <Tag tone={tone}>{delta}</Tag> : null}
      </div>
      {meta ? <div className="card-meta">{meta}</div> : null}
    </div>
  );
}

export function InsetTile({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="tile-inset">
      <div className="eyebrow text-muted">{label}</div>
      <div className="num tile-value">{value}</div>
    </div>
  );
}

export type Tone = "accent" | "sage" | "neutral" | "outline";
const TONES: Record<Tone, string> = { accent: "tag-accent", sage: "tag-accent-2", neutral: "tag-neutral", outline: "tag-outline" };

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag ${TONES[tone]}`}>{children}</span>;
}

const STATUS: Record<JobStatus, [string, Tone]> = {
  running: ["En cours", "accent"], queued: ["En attente", "outline"], completed: ["Terminée", "sage"],
  cancelled: ["Annulée", "neutral"], failed: ["Échouée", "accent"], unknown: ["Inconnue", "neutral"],
};
export const StatusTag = ({ status }: { status: JobStatus }) => <Tag tone={STATUS[status][1]}>{STATUS[status][0]}</Tag>;

export function Button({ variant = "secondary", loading, children, className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button {...rest} type={rest.type ?? "button"} disabled={rest.disabled || loading} className={`btn btn-${variant} ${className}`}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Meter({ value, tone = "accent" }: { value: number; tone?: "accent" | "sage" | "neutral" }) {
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span className={`meter-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(option => (
        <label key={option.value} className="seg-opt">
          <input type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const HEIGHT = 120;
/** Stacked daily bars: completed (sage) under cancelled (neutral) under failed (accent). The last bar is today. */
export function OutcomeChart({ days }: { days: { label: string; completed: number; cancelled: number; failed: number }[] }) {
  const max = Math.max(1, ...days.map(day => day.completed + day.cancelled + day.failed));
  const slot = 100 / Math.max(1, days.length), width = slot * 0.62, plot = HEIGHT - 8;
  const layers = [["completed", "var(--color-accent-2-600)"], ["cancelled", "var(--color-neutral-400)"], ["failed", "var(--color-accent)"]] as const;
  return (
    <>
      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" className="chart" aria-hidden="true">
        <g stroke="var(--color-divider)" strokeWidth="0.5">
          {[30, 60, 90, HEIGHT - 1].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}
        </g>
        {days.map((day, index) => {
          let base = HEIGHT - 1;
          return (
            <g key={day.label}>
              {layers.map(([field, color]) => {
                const height = (day[field] / max) * plot;
                base -= height;
                return <rect key={field} x={index * slot + (slot - width) / 2} y={base} width={width} height={height} fill={color} />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="eyebrow text-muted chart-ticks">
        {days.filter((_, index) => index % 7 === 0 || index === days.length - 1).map(day => <span key={day.label}>{day.label}</span>)}
      </div>
      <div className="legend">
        {layers.map(([field, color]) => (
          <span key={field}><i style={{ background: color }} />{{ completed: "Terminées", cancelled: "Annulées", failed: "Échouées" }[field]}</span>
        ))}
      </div>
    </>
  );
}

/** Re-runs `load` every `ms` while the tab is visible; returns the last value and error. */
export function usePolling<T>(load: () => Promise<T>, ms: number, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (document.hidden) return;
      load().then(data => alive && setState({ data }), error => alive && setState(previous => ({ ...previous, error })));
    };
    run();
    const timer = setInterval(run, ms);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, refresh: () => setTick(value => value + 1) };
}

export const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR", { notation: value >= 100_000 ? "compact" : "standard" }).format(value);
export const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds / 60) % 60} min`;
};
export const formatDate = (value?: string | number) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "—";
