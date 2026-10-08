import { ChevronDown } from "lucide-react";
import { getPreviewBoostBonuses, getPreviewBoosts, getSpellLevel, type Catalog, type CombatPreviewState } from "@dofus/shared";
import { GameImage } from "../../../components/GameImage";
import { readableText } from "../../../lib/effect-text";
import { BonusList } from "./BonusList";
import { Stepper } from "./Stepper";

type Boost = ReturnType<typeof getPreviewBoosts>[number];
type Activation = CombatPreviewState["boosts"][string];

export function BoostCard({ boost, activation, characterLevel, catalog, onChange }: {
  boost: Boost; activation: Activation; characterLevel: number; catalog: Catalog; onChange: (activation: Activation) => void;
}) {
  const change = (changes: Partial<Activation>) => onChange({ ...activation, ...changes });
  return <div className={`combat-effect-card ${activation.enabled ? "active" : ""}`}>
    <label className="combat-effect-toggle"><GameImage src={boost.spell.icon} /><span><strong>{boost.spell.name}</strong><small>Niveau {getSpellLevel(boost.spell, characterLevel)?.minPlayerLevel} · bonus du sort déjà lancé</small></span>
      <input type="checkbox" aria-label={`Activer le boost ${boost.spell.name}`} checked={activation.enabled} onChange={event => change({ enabled: event.target.checked })} /></label>
    <BonusList stats={getPreviewBoostBonuses(boost, !!activation.critical)} catalog={catalog} />
    {activation.enabled && <div className="combat-boost-controls">
      {boost.criticalEffects.length > 0 && <div className="segment" aria-label={`Lancer du boost ${boost.spell.name}`}>{([false, true] as const).map(critical => <button key={String(critical)} className={!!activation.critical === critical ? "active" : ""} aria-pressed={!!activation.critical === critical} onClick={() => change({ critical })}>{critical ? "Boost critique" : "Boost normal"}</button>)}</div>}
      {boost.maxStacks > 1 && <Stepper label={`Cumuls de ${boost.spell.name}`} value={activation.stacks ?? 1} max={boost.maxStacks} shortcuts={[1, boost.maxStacks]} onChange={stacks => change({ stacks })} />}
      <label className="combat-duration">Lancé il y a<select aria-label={`Ancienneté du boost ${boost.spell.name}`} value={activation.age ?? 0} onChange={event => change({ age: Number(event.target.value) })}>
        {Array.from({ length: Math.min(20, boost.duration) + 1 }, (_, age) => <option key={age} value={age}>{age === 0 ? "Ce tour" : `${age} tour${age > 1 ? "s" : ""}`}</option>)}</select></label>
    </div>}
    {activation.enabled && (activation.age ?? 0) >= boost.duration && <p className="combat-effect-note">Boost expiré : aucun bonus appliqué à cet aperçu.</p>}
    <details className="combat-effect-description"><summary>Effets et conditions <ChevronDown size={12} /></summary><p>{readableText(boost.spell.description)}</p><p>Seuls les bonus de caractéristiques listés sont appliqués. Les dégâts du lancement, déplacements, états et effets dépendant d’une cible ne sont pas simulés ici.</p></details>
  </div>;
}
