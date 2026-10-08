import { CHARACTER_STATS, type BuildEvaluation, type Catalog, type Character } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

const names: Record<string, string> = { vitality: "Vita.", strength: "Force", intelligence: "Intel.", chance: "Chance", agility: "Agi.", wisdom: "Sag." };

/** Base, scroll and equipment parts of each characteristic. */
export function BaseStatsTable({ catalog, character, evaluation }: {
  catalog: Catalog;
  character: Character;
  evaluation: BuildEvaluation;
}) {
  const stats = evaluation.stats;
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
            <td>{fmt(detail?.base ?? (character.allocationMode === "manual" ? character.baseStats[key] : evaluation.build.baseStats?.[key]) ?? 0)}</td>
            <td>{fmt(detail?.scroll ?? character.scrollStats?.[key] ?? 0)}</td>
            <td>{fmt(detail?.equipment ?? 0)}</td>
            <td><strong>{fmt(total)}</strong>{power !== 0 && <small>({fmt(total + power)})</small>}</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="power-description">Entre parenthèses : total pour les dégâts avec la puissance. Les prérequis des objets utilisent la valeur sans puissance. Elle n’augmente ni la prospection, ni les soins, ni les autres bonus des caractéristiques.</p>
    </section>
  );
}
