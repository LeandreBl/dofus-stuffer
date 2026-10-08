import { STAT_CAPS, type Catalog, type Constraint, type EquipmentItem, type Stats } from "@dofus/shared";
import { withoutCreatureTarget } from "../lib/spell-scenario";

export type EditorContext = {
  catalog: Catalog;
  characterLevel: number;
  stats: Stats;
  weapon?: EquipmentItem;
};
export type EditorActions = {
  onSave: (criteria: Constraint[], replacedIds: string[]) => void;
  onClose: () => void;
};
export const cappedCriterion = (draft: Constraint): Constraint => {
  const maximum = draft.kind === "stat" ? STAT_CAPS[draft.statKey || ""] : undefined;
  return maximum !== undefined && ["atLeast", "atMost"].includes(draft.relation)
    ? { ...draft, target: Math.min(maximum, draft.target) }
    : draft;
};
export const savedCriterion = (draft: Constraint): Constraint => ({
  ...cappedCriterion(draft),
  strict: !["maximize", "minimize"].includes(draft.relation) && draft.strict,
  ...(draft.scenario ? { scenario: withoutCreatureTarget(draft.scenario) } : {}),
});
