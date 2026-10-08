import { ShieldCheck } from "lucide-react";
import { canIncludePower, STAT_CAPS, type Constraint } from "@dofus/shared";
import { fmt, statUnit } from "../lib/format";
import { cappedCriterion, type EditorContext } from "./criteria";
import { CriticalChanceNotice } from "./fields/CriticalChanceNotice";
import { DamageRollOptions } from "./fields/DamageRollOptions";
import { PowerOption } from "./fields/PowerOption";
import { RelationPicker } from "./fields/RelationPicker";
import { TargetValue } from "./fields/TargetValue";

export function ConstraintFields({ draft, onChange, ...context }: EditorContext & { draft: Constraint; onChange: (draft: Constraint) => void }) {
  const stat = context.catalog.stats.find((entry) => entry.key === draft.statKey);
  const damageCriterion = draft.kind === "spell" || draft.kind === "weapon";
  const criticalChance = damageCriterion && draft.metric === "criticalChance";
  const statMaximum = draft.kind === "stat" ? STAT_CAPS[draft.statKey || ""] : undefined;
  const numeric = !["maximize", "minimize"].includes(draft.relation);
  const update = (changes: Partial<Constraint>) =>
    onChange(cappedCriterion({ ...draft, ...changes }));
  return (
    <>
      <RelationPicker draft={draft} update={update} label={damageCriterion ? criticalChance ? "Objectif de chance de critique" : "Objectif de dégâts" : "Objectif du critère"} />
      {canIncludePower(draft) && <PowerOption draft={draft} catalog={context.catalog} stats={context.stats} update={update} />}
      {numeric && <TargetValue draft={draft} catalog={context.catalog} update={update} />}
      {statMaximum !== undefined && (
        <p className="inline-notice">Maximum du personnage : <strong>{fmt(statMaximum)}{statUnit(stat) === "%" ? " %" : ` ${stat?.name || ""}`}</strong>. Les bonus au-delà de ce plafond n’augmentent pas la valeur effective.</p>
      )}
      {criticalChance && <CriticalChanceNotice draft={draft} {...context} />}
      {damageCriterion && !criticalChance && <DamageRollOptions draft={draft} update={update} />}
      {numeric && (
        <div className="check-field">
          <ShieldCheck size={18} color="#bfd583" />
          <label htmlFor={`strict-target-${draft.id}`}>
            Rendre cette cible obligatoire
            <small>Les résultats doivent respecter cette cible.</small>
          </label>
          <input
            id={`strict-target-${draft.id}`}
            type="checkbox"
            checked={draft.strict}
            onChange={(event) => update({ strict: event.target.checked })}
          />
        </div>
      )}
    </>
  );
}
