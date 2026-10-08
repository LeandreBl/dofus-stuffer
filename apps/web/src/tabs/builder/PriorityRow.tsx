import { GripVertical, X } from "lucide-react";
import type { BuildEvaluation, Catalog, Constraint } from "@dofus/shared";
import { CriterionIcon } from "../../constraints/CriterionIcon";
import { constraintName, constraintTarget } from "../../constraints/describe";
import { fmt } from "../../lib/format";

export function PriorityRow({ catalog, criterion, evaluation, level, levels, onEdit, onMove, onRemove, onDragEnd }: {
  catalog: Catalog;
  criterion: Constraint;
  evaluation: BuildEvaluation;
  level: number;
  levels: number[];
  onEdit: () => void;
  onMove: (level: number) => void;
  onRemove: () => void;
  onDragEnd: () => void;
}) {
  const name = constraintName(catalog, criterion);
  const result = evaluation.constraints.find((entry) => entry.id === criterion.id);
  return (
    <div
      className="priority-row"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", criterion.id)}
      onDragEnd={onDragEnd}
    >
      <GripVertical className="grip" size={15} />
      <button className="priority-edit" onClick={onEdit}>
        <CriterionIcon catalog={catalog} criterion={criterion} weapon={catalog.items.find((item) => item.id === evaluation.build.slots.weapon)} />
        <span className="priority-copy">
          <strong>{name}</strong>
          <small>
            {constraintTarget(criterion)}
            {criterion.strict && <b> · Obligatoire</b>}
          </small>
          {criterion.metric === "criticalChance" && (
            <small className="priority-current">
              Avec ton stuff : {result?.supported ? `${fmt(result.value)} %` : "À vérifier"}
            </small>
          )}
        </span>
      </button>
      <select
        className="priority-select"
        aria-label={`Déplacer ${name}`}
        value={level}
        onChange={(event) => onMove(Number(event.target.value))}
      >
        {levels.map((number, order) => (
          <option key={number} value={number}>
            Priorité {order + 1}
          </option>
        ))}
        <option value={(levels.at(-1) || 0) + 1}>Nouveau niveau</option>
      </select>
      <button className="icon-button" onClick={onRemove} aria-label={`Supprimer ${name}`}>
        <X size={13} />
      </button>
    </div>
  );
}
