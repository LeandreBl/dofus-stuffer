import { CHARACTER_STATS, type BuildEvaluation, type Catalog, type Character } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

const names: Record<string, string> = { vitality: "Vita.", strength: "Force", intelligence: "Intel.", chance: "Chance", agility: "Agi.", wisdom: "Sag." };

/** Base, scroll and equipment parts of each characteristic. */
export function BaseStatsTable({ catalog, character, evaluation, onChange }: {
  catalog: Catalog;
  character: Character;
  evaluation: BuildEvaluation;
  onChange: (character: Character) => void;
}) {
  const stats = evaluation.stats;
  const base = (key: string) => evaluation.breakdown?.[key]?.base ?? (character.allocationMode === "manual" ? character.baseStats[key] : evaluation.build.baseStats?.[key]) ?? 0;
  const value = (input: string, max = Infinity) => Math.max(0, Math.min(max, Math.floor(Number(input)) || 0));
  // Editing a base value switches to manual allocation, seeded with the base currently shown.
  const setBase = (key: string, input: string) => onChange({
    ...character,
    allocationMode: "manual",
    baseStats: { ...Object.fromEntries(CHARACTER_STATS.map((stat) => [stat, base(stat)])), [key]: value(input) },
  });
  return (
    <section className="panel build-base-stats">
      <h3>Mes vraies caractéristiques</h3>
      <table className="stat-breakdown">
        <thead><tr><th>Carac.</th><th>Base</th><th>Parcho</th><th>Stuff</th><th>Total</th></tr></thead>
        <tbody>{CHARACTER_STATS.map((key) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          const detail = evaluation.breakdown?.[key];
          const total = stats[key] || 0;
          const power = ["strength", "intelligence", "chance", "agility"].includes(key) ? stats.damagePercent || 0 : 0;
          return <tr key={key} title={`${stat?.name || key} : base + parchotage + équipement et panoplies${power ? `, ${fmt(total + power)} pour les dégâts avec la puissance` : ""}`}>
            <td><span><StatIcon stat={stat} />{names[key]}</span></td>
            <td><input type="number" min="0" step="1" aria-label={`Base ${stat?.name || key}`} value={base(key)} onChange={(event) => setBase(key, event.target.value)} /></td>
            <td><input type="number" min="0" max="100" step="1" aria-label={`Parchotage ${stat?.name || key}`} value={character.scrollStats?.[key] ?? 0} onChange={(event) => onChange({ ...character, scrollStats: { ...character.scrollStats, [key]: value(event.target.value, 100) } })} /></td>
            <td>{fmt(detail?.equipment ?? 0)}</td>
            <td><strong>{fmt(total)}</strong>{power !== 0 && <small>({fmt(total + power)})</small>}</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="power-description">Entre parenthèses : total pour les dégâts avec la puissance. Les prérequis des objets utilisent la valeur sans puissance. Elle n’augmente ni la prospection, ni les soins, ni les autres bonus des caractéristiques.</p>
    </section>
  );
}
