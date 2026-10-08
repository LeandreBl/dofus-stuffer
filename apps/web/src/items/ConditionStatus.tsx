import { Check, Info, X } from "lucide-react";
import type { ConditionDiagnostic } from "@dofus/shared";
import { fmt } from "../lib/format";

export function ConditionStatus({ condition, optional = false }: { condition: ConditionDiagnostic; optional?: boolean }) {
  const state = optional && condition.satisfied !== true ? "optional" : condition.satisfied === null ? "unknown" : condition.satisfied ? "satisfied" : "failed";
  const Icon = condition.satisfied === true ? Check : optional ? Info : condition.satisfied === false ? X : Info;
  const compound = condition.kind === "and" || condition.kind === "or";
  return <div className={`item-condition ${state}`}>
    <div className="item-condition-line">
      <Icon size={13} aria-hidden="true" />
      <span>{compound ? condition.kind === "and" ? "Toutes ces conditions" : "Au moins une de ces conditions" : condition.text}</span>
      <small>{optional && condition.satisfied !== true ? "Non nécessaire" : condition.satisfied === null ? "À vérifier" : condition.satisfied ? "Respectée" : "Non respectée"}</small>
    </div>
    {compound && condition.children?.length ? <div className="item-condition-children">{condition.children.map((child, index) => <ConditionStatus key={index} condition={child} optional={optional || (condition.kind === "or" && condition.satisfied === true)} />)}</div> : condition.actual !== undefined && <p className="item-condition-value">{["strength", "intelligence", "chance", "agility"].includes(condition.stat || "") ? "Valeur réelle, sans puissance" : "Valeur avec ce stuff"} : <strong>{fmt(condition.actual)}</strong></p>}
  </div>;
}
