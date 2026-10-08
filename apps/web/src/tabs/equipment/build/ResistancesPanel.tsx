import type { Catalog, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

const elements = ["neutral", "earth", "fire", "water", "air"];
const iconKeys: Record<string, string> = {
  neutral: "neutralDamageBonus",
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
};
const rows: [string, (element: string) => string, string][] = [
  ["Do.", (element) => `${element}DamageBonus`, ""],
  ["Rés.", (element) => `${element}ElementReduction`, ""],
  ["Rés. %", (element) => `${element}ElementResistPercent`, "%"],
];

export function ResistancesPanel({ catalog, stats }: { catalog: Catalog; stats: Stats }) {
  return (
    <section className="panel">
      <h3>Résistances & dommages</h3>
      <table className="resist-table">
        <thead>
          <tr>
            <th></th>
            {elements.map((element) => (
              <th key={element}>
                <StatIcon stat={catalog.stats.find((stat) => stat.key === iconKeys[element])} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key, unit]) => (
            <tr key={label}>
              <td>{label}</td>
              {elements.map((element) => (
                <td key={element}>{fmt(stats[key(element)] || 0)}{unit}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
