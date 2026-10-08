import type { Catalog, Constraint, EquipmentItem, Stats } from "@dofus/shared";
import { SingleConstraintEditor } from "./SingleConstraintEditor";
import { SpellConstraintEditor } from "./SpellConstraintEditor";

export function ConstraintEditor({
  criterion,
  constraints,
  catalog,
  characterLevel,
  stats,
  weapon,
  onSave,
  onClose,
}: {
  criterion: Constraint;
  constraints: Constraint[];
  catalog: Catalog;
  characterLevel: number;
  stats: Stats;
  weapon?: EquipmentItem;
  onSave: (criteria: Constraint[], replacedIds: string[]) => void;
  onClose: () => void;
}) {
  const props = { catalog, characterLevel, stats, weapon, onSave, onClose };
  return criterion.kind === "spell" || criterion.kind === "weapon"
    ? <SpellConstraintEditor key={criterion.id} criterion={criterion} constraints={constraints} {...props} />
    : <SingleConstraintEditor key={criterion.id} criterion={criterion} {...props} />;
}
