import { ChevronDown } from "lucide-react";
import { getPreviewPassiveBonuses, type Catalog, type CombatPreviewState, getPreviewPassives } from "@dofus/shared";
import { GameImage } from "../../../components/GameImage";
import { readableText } from "../../../lib/effect-text";
import { BonusList } from "./BonusList";
import { Stepper } from "./Stepper";

type Passive = ReturnType<typeof getPreviewPassives>[number];
type Activation = CombatPreviewState["passives"][string];

export function PassiveCard({ entry, activation, turn, catalog, onChange }: {
  entry: Passive; activation: Activation; turn: number; catalog: Catalog; onChange: (activation: Activation) => void;
}) {
  const disabled = entry.status === "unsupported";
  const value = activation.value ?? entry.parameter?.defaultValue ?? 1;
  const change = (changes: Partial<Activation>) => onChange({ ...activation, ...changes });
  return <div role="group" aria-label={`${entry.item.name} · ${entry.label}`} className={`combat-effect-card ${activation.enabled && !disabled ? "active" : ""} ${disabled ? "unavailable" : ""}`}>
    <label className="combat-effect-toggle"><GameImage src={entry.item.icon} /><span><strong>{entry.item.name}</strong><small>{entry.label}</small></span>
      <input type="checkbox" aria-label={`Activer ${entry.item.name} · ${entry.label}`} checked={activation.enabled && !disabled} disabled={disabled} onChange={event => change({ enabled: event.target.checked })} /></label>
    <BonusList stats={getPreviewPassiveBonuses(entry, turn, value)} catalog={catalog} />
    {activation.enabled && entry.parameter && <Stepper {...entry.parameter} value={value} onChange={value => change({ value })} />}
    {activation.enabled && entry.duration && <label className="combat-duration">Tours restants<select aria-label={`Tours restants · ${entry.item.name} · ${entry.label}`} value={activation.remainingTurns ?? entry.duration} onChange={event => change({ remainingTurns: Number(event.target.value) })}>
      {Array.from({ length: Math.min(20, entry.duration) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}
    {entry.note && <p className="combat-effect-note">{entry.note}</p>}
    {entry.passive.description && <details className="combat-effect-description"><summary>Conditions du passif <ChevronDown size={12} /></summary><p>{readableText(entry.passive.description)}</p></details>}
  </div>;
}
