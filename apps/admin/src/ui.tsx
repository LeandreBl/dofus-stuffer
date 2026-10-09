import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

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

export function Button({ variant = "secondary", loading, children, className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button {...rest} type={rest.type ?? "button"} disabled={rest.disabled || loading} className={`btn btn-${variant} ${className}`}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
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
export const formatDate = (value?: string | number) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "—";
