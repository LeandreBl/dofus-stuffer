import { Sparkles } from "lucide-react";

const durations: [number, string][] = [
  [5, "Rapide · 5 s"],
  [15, "Équilibré · 15 s"],
  [60, "Approfondi · 1 min"],
  [120, "Patient · 2 min"],
  [300, "Poussé · 5 min"],
  [600, "Intensif · 10 min"],
];

export function LaunchPanel({ seconds, searching, onSeconds, onFollow }: {
  seconds: number;
  searching: boolean;
  onSeconds: (seconds: number) => void;
  onFollow: () => void;
}) {
  return (
    <section className="launch-panel">
      <div className="launch-line">
        <span>Temps de recherche</span>
        <select
          aria-label="Temps de recherche"
          value={seconds}
          onChange={(event) => onSeconds(Number(event.target.value))}
        >
          {durations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <p className="launch-caption">
        <Sparkles size={11} /> Des résultats qui s’améliorent au fil
        de la recherche
      </p>
      {searching && (
        <button className="button ghost small wide" style={{ marginTop: 12 }} onClick={onFollow}>
          Suivre la recherche
        </button>
      )}
    </section>
  );
}
