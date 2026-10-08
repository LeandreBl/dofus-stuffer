import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { Constraint, OptimizationRequest } from "@dofus/shared";

const MAX_CRITERIA = 40;

/** Criterion being edited in the modal, and how a saved edit lands in the priorities. */
export function useCriterionEditor(request: OptimizationRequest, setRequest: Dispatch<SetStateAction<OptimizationRequest>>, notify: (message: string) => void) {
  const [editing, setEditing] = useState<Constraint | null>(null);
  const close = useCallback(() => setEditing(null), []);
  /** Opens a new criterion at a new lowest priority level. */
  const add = (criterion: Constraint) =>
    setEditing({
      ...criterion,
      priority: request.constraints.length
        ? Math.max(...request.constraints.map((value) => value.priority)) + 1
        : 0,
    });
  const save = (criteria: Constraint[], replacedIds: string[]) => {
    const replaced = new Set(replacedIds);
    if (request.constraints.filter((entry) => !replaced.has(entry.id)).length + criteria.length > MAX_CRITERIA) {
      notify("Tu peux définir jusqu’à 40 critères. Retire un critère pour ajouter ces objectifs.");
      return;
    }
    setRequest((value) => ({
      ...value,
      constraints: [
        ...value.constraints.flatMap((entry) => {
          if (!replaced.has(entry.id)) return [entry];
          const updated = criteria.find((candidate) => candidate.id === entry.id);
          return updated ? [updated] : [];
        }),
        ...criteria.filter((entry) => !value.constraints.some((existing) => existing.id === entry.id)),
      ],
    }));
    setEditing(null);
    notify(criteria.length > 1 ? "Les deux objectifs sont enregistrés dans tes priorités." : "Critère enregistré dans tes priorités.");
  };
  return { editing, edit: setEditing, add, save, close };
}
