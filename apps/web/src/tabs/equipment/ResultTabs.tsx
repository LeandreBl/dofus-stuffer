import { Layers3, Swords } from "lucide-react";
import type { JobSnapshot, OptimizationRequest, Slot } from "@dofus/shared";
import { money } from "../../lib/format";

type Result = JobSnapshot["results"][number];

/** The best result and its alternatives; one replacing a locked item cannot be picked. */
export function ResultTabs({ results, lockedSlots, selected, onSelect }: {
  results: Result[];
  lockedSlots: OptimizationRequest["filters"]["lockedSlots"];
  selected: number;
  onSelect: (index: number, result: Result) => void;
}) {
  return (
    <div className="results-tabs">
      {results.map((result, index) => {
        const changesLockedItem = Object.entries(lockedSlots).some(([slot, id]) => result.build.slots[slot as Slot] !== id);
        return (
          <button
            key={index}
            className={`result-tab ${selected === index ? "active" : ""}`}
            disabled={changesLockedItem}
            title={changesLockedItem ? "Cette alternative remplace une pièce verrouillée. Déverrouille-la ou relance la recherche avec ta base." : undefined}
            onClick={() => onSelect(index, result)}
          >
            <span>{index === 0 ? <Swords size={18} /> : <Layers3 size={18} />}</span>
            <span>
              <strong>{index === 0 ? "Meilleur stuff trouvé" : `Alternative ${index + 1}`}</strong>
              <small>
                {money(result.cost)} ·{" "}
                {result.valid
                  ? `${result.constraints.filter((criterion) => criterion.satisfied).length} / ${result.constraints.length} objectifs atteints`
                  : "À vérifier"}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
