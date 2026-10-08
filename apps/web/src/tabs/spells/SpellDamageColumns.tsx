import type { Catalog, SpellDamage } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";
import { elementKeys, elementNames, rangeLabel } from "./damage";

const triggerNames: Record<string, string> = { TB: "début de tour", TE: "fin de tour", PIÈGE: "piège", GLYPHE: "glyphe" };

/** Normal and critical damage of a spell, side by side, with their elemental lines. */
export function SpellDamageColumns({ catalog, damage }: { catalog: Catalog; damage: SpellDamage }) {
  return (
    <div className="damage-columns">
      {(["normal", "critical"] as const).map((mode) => {
        const range = damage[mode];
        return (
          <div className={`damage-block ${mode}`} key={mode}>
            <label>
              <StatIcon stat={catalog.stats.find((stat) => stat.key === (mode === "critical" ? "criticalHit" : "dealtDamageMultiplierSpells"))} />
              {mode === "normal" ? "Coup normal" : "Coup critique"}
            </label>
            <strong>{damage.supported ? rangeLabel(range) : "À vérifier"}</strong>
            <small>
              {damage.supported && range
                ? `Moyenne ${fmt(range.average)} · ${fmt(damage.apCost ? range.average / damage.apCost : 0)} / PA`
                : mode === "critical" && !range
                  ? "Ce sort ne possède pas de coup critique."
                  : "Mécanique non prise en charge"}
            </small>
            {damage.supported && damage.lines.length > 0 && (
              <div className="damage-lines">
                {damage.lines.map((line, index) => (
                  <span key={index}>
                    <StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[line.element])} />
                    {rangeLabel(line[mode])}{" "}
                    {line.kind === "push" ? "Poussée" : elementNames[line.element]}
                    {line.delay > 0 ? ` (T+${line.delay})` : ""}
                    {line.trigger ? ` · ${triggerNames[line.trigger] ?? "déclenchement"}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
