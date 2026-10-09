import type { CSSProperties } from "react";
import { ArrowRight, LoaderCircle, Square, WandSparkles } from "lucide-react";

export function LaunchButton({ starting, active, disabled, withBase, percent, onLaunch, onCancel }: {
  starting: boolean;
  active: boolean;
  disabled: boolean;
  /** Some items are locked: the search restarts from them. */
  withBase: boolean;
  /** Progress of the running search, filled into the button. */
  percent?: number;
  onLaunch: () => void;
  onCancel: () => void;
}) {
  const busy = starting || active;
  return (
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
  );
}
