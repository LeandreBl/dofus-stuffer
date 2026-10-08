import type { CSSProperties } from "react";
import { ArrowRight, LoaderCircle, WandSparkles } from "lucide-react";

export function LaunchButton({ starting, active, disabled, withBase, percent, onLaunch }: {
  starting: boolean;
  active: boolean;
  disabled: boolean;
  /** Some items are locked: the search restarts from them. */
  withBase: boolean;
  /** Progress of the running search, filled into the button. */
  percent?: number;
  onLaunch: () => void;
}) {
  const busy = starting || active;
  return (
    <button
      className="button primary launch-button"
      disabled={busy || disabled}
      onClick={onLaunch}
      style={percent === undefined ? undefined : { "--progress": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}
    >
      {busy ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
      {starting
        ? "Démarrage…"
        : active
          ? "Recherche en cours"
          : withBase
            ? "Relancer avec ma base"
            : "Trouver mon stuff"}
      {!busy && <ArrowRight size={16} />}
    </button>
  );
}
