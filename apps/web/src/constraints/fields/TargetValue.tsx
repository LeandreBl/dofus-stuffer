import { Minus, Plus } from "lucide-react";
import { STAT_CAPS, type Catalog, type Constraint } from "@dofus/shared";
import { fmt, statUnit } from "../../lib/format";

/** Numeric target with +/- steps and quick presets. */
export function TargetValue({ draft, catalog, update }: {
  draft: Constraint;
  catalog: Catalog;
  update: (changes: Partial<Constraint>) => void;
}) {
  const stat = catalog.stats.find((entry) => entry.key === draft.statKey);
  const price = draft.kind === "price";
  const damageCriterion = draft.kind === "spell" || draft.kind === "weapon";
  const criticalChance = damageCriterion && draft.metric === "criticalChance";
  const scale = price ? 1_000_000 : 1;
  const statMaximum = draft.kind === "stat" ? STAT_CAPS[draft.statKey || ""] : undefined;
  const maximum = statMaximum ?? (criticalChance ? 100 : price ? 10_000_000_000 : 10_000_000);
  const step = criticalChance || (statMaximum !== undefined && statUnit(stat) === "%") ? 5 : scale * (price || draft.target < 20 ? 1 : 50);
  const short =
    draft.statKey === "actionPoints"
      ? [10, 11, 12]
      : draft.statKey === "movementPoints"
        ? [4, 5, 6]
        : draft.statKey === "range"
          ? [3, 4, 5, 6]
          : criticalChance
            ? [50, 75, 100]
          : damageCriterion
            ? [500, 1000, 1500, 2000]
            : price
              ? [5, 10, 20, 50, 100]
              : statUnit(stat) === "%"
                ? [10, 20, 30, 50]
                : [100, 300, 500, 1000];
  return (
    <>
      <div className="target-input">
        <button
          className="button"
          aria-label="Diminuer la cible"
          disabled={draft.target <= 0}
          onClick={() => update({ target: Math.max(0, draft.target - step) })}
        >
          <Minus size={17} />
        </button>
        <input
          aria-label={
            price ? "Budget en millions de kamas" : criticalChance ? "Chance de critique cible en pourcentage" : "Valeur cible"
          }
          type="number"
          min="0"
          max={maximum / scale}
          step={price ? 0.1 : 1}
          value={draft.target / scale}
          onChange={(event) =>
            update({
              target: Math.min(maximum, Math.max(0, Number(event.target.value) * scale)),
            })
          }
        />
        <button
          className="button"
          aria-label="Augmenter la cible"
          disabled={draft.target >= maximum}
          onClick={() => update({ target: Math.min(maximum, draft.target + step) })}
        >
          <Plus size={17} />
        </button>
      </div>
      <p className="inline-notice">
        {price
          ? "Millions de kamas · selon les prix renseignés pour ton serveur"
          : criticalChance
            ? `Probabilité de coup critique ${draft.kind === "weapon" ? "de l’arme" : "de ce sort"}, avec les bonus du personnage.`
          : draft.statKey === "damagePercent"
            ? "Points ajoutés aux caractéristiques pour les dégâts uniquement. Aucun bonus de prospection, de soins, de tacle ou de fuite."
            : `${damageCriterion ? "Dégâts infligés à la cible du simulateur" : `Valeur totale du personnage${statUnit(stat) ? `, en ${statUnit(stat)}` : ""}`}`}
      </p>
      <div className="preset-values">
        {short.filter((value) => value * scale <= maximum).map((value) => (
          <button
            key={value}
            className={draft.target === value * scale ? "active" : ""}
            onClick={() => update({ target: value * scale })}
          >
            {fmt(value)}
            {price ? " M" : criticalChance || statUnit(stat) === "%" ? " %" : ""}
          </button>
        ))}
      </div>
    </>
  );
}
