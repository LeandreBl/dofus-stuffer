import { ChevronRight, Settings2 } from "lucide-react";
import type { Catalog, CombatTarget, Element } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { elementKeys, elementNames } from "./damage";

const elements: Element[] = ["neutral", "earth", "fire", "water", "air"];

export function TargetSettings({ catalog, target, onChange }: {
  catalog: Catalog;
  target: CombatTarget;
  onChange: (changes: Partial<CombatTarget>) => void;
}) {
  return (
    <section className="panel damage-target-panel">
      <details className="target-settings">
        <summary>
          <Settings2 size={14} /> Cible & situation de combat{" "}
          <ChevronRight size={13} />
        </summary>
        <p className="target-heading">Résistances élémentaires (%)</p>
        <div className="target-fields">
          {elements.map((element) => (
            <label key={element}>
              <StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />
              {elementNames[element]}
              <input
                type="number"
                min="-100"
                max="100"
                value={target.percent[element] || 0}
                onChange={(event) =>
                  onChange({
                    percent: {
                      ...target.percent,
                      [element]: Math.max(-100, Math.min(100, Number(event.target.value))),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <p className="target-heading">Résistances fixes</p>
        <div className="target-fields">
          {elements.map((element) => (
            <label key={element}>
              {elementNames[element]}
              <input
                type="number"
                min="0"
                value={target.flat[element] || 0}
                onChange={(event) =>
                  onChange({
                    flat: { ...target.flat, [element]: Math.max(0, Number(event.target.value)) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="modal-options">
          <label className="field">
            Résistance critique
            <input
              type="number"
              min="0"
              value={target.criticalResistance}
              onChange={(event) => onChange({ criticalResistance: Math.max(0, Number(event.target.value)) })}
            />
          </label>
          <label className="field">
            Distance
            <select
              value={target.distance}
              onChange={(event) => onChange({ distance: event.target.value as CombatTarget["distance"] })}
            >
              <option value="ranged">À distance</option>
              <option value="melee">En mêlée</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
