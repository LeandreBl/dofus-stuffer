import { ArrowRight, LoaderCircle, WandSparkles } from "lucide-react";

export function LaunchButton({ starting, active, disabled, withBase, onLaunch }: {
  starting: boolean;
  active: boolean;
  disabled: boolean;
  /** Some items are locked: the search restarts from them. */
  withBase: boolean;
  onLaunch: () => void;
}) {
  const busy = starting || active;
  return (
    <button className="button primary launch-button" disabled={busy || disabled} onClick={onLaunch}>
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
