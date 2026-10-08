import { useState } from "react";
import { Check } from "lucide-react";
import type { Constraint } from "@dofus/shared";
import { Modal } from "../components/Modal";
import { ConstraintFields } from "./ConstraintFields";
import { cappedCriterion, savedCriterion, type EditorActions, type EditorContext } from "./criteria";
import { CriterionIcon } from "./CriterionIcon";
import { constraintName } from "./describe";

export function SingleConstraintEditor({
  criterion, onSave, onClose, ...context
}: EditorContext & EditorActions & { criterion: Constraint }) {
  const [draft, setDraft] = useState(() => cappedCriterion(criterion));
  return (
    <Modal title={constraintName(context.catalog, draft)} onClose={onClose} icon={<CriterionIcon catalog={context.catalog} criterion={draft} />}>
      <p>Choisis ce que tu vises. Tu pourras ensuite déplacer ce critère dans ta liste de priorités.</p>
      <ConstraintFields draft={draft} onChange={setDraft} {...context} />
      <div className="modal-actions">
        <button className="button ghost" onClick={onClose}>Annuler</button>
        <button className="button primary" onClick={() => onSave([savedCriterion(draft)], [criterion.id])}>
          <Check size={15} /> Enregistrer
        </button>
      </div>
    </Modal>
  );
}
