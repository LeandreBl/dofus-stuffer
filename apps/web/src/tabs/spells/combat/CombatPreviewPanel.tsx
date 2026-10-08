import { useMemo, useState } from "react";
import { ArrowBigUpDash, ChevronDown, RotateCcw } from "lucide-react";
import { defaultCombatPreview, getPreviewBoosts, getPreviewPassives,
  type Build, type Catalog, type Character, type CombatPreviewContext, type CombatPreviewState } from "@dofus/shared";
import { BonusList } from "./BonusList";
import { BoostPicker } from "./BoostPicker";
import { PassiveCard } from "./PassiveCard";
import { Stepper } from "./Stepper";

export function CombatPreviewPanel({ catalog, build, character, state, context, onChange }: {
  catalog: Catalog; build: Build; character: Character; state: CombatPreviewState; context: CombatPreviewContext; onChange: (state: CombatPreviewState) => void;
}) {
  const passives = useMemo(() => getPreviewPassives(catalog, build), [catalog, build]);
  const boosts = useMemo(() => getPreviewBoosts(catalog, character), [catalog, character]);
  const [open, setOpen] = useState(false);
  const activeCount = passives.filter(passive => state.passives[passive.key]?.enabled && passive.status !== "unsupported").length
    + boosts.filter(boost => state.boosts[String(boost.spell.id)]?.enabled).length;
  return <section className="panel combat-preview-panel" aria-label="Passifs et boosts de la prévisualisation">
    <div className="panel-head"><div><h2><button className="panel-fold" aria-expanded={open} onClick={() => setOpen(!open)}><ArrowBigUpDash size={22} /> Passifs & boosts <ChevronDown size={16} /></button></h2><p>Choisis les effets déjà actifs sur ton personnage.</p></div>
      <div className="combat-preview-actions"><span className="counter">{activeCount} actif{activeCount > 1 ? "s" : ""}</span>
        <button className="icon-button" aria-label="Réinitialiser les passifs et boosts" title="Tout désactiver" onClick={() => onChange(defaultCombatPreview())}><RotateCcw size={15} /></button></div></div>
    {open && <>
    <div className="combat-turn-row"><Stepper label="Tour de combat" value={state.turn} max={999} shortcuts={[1, 2, 3, 4]} onChange={turn => onChange({ ...state, turn })} />
      <small>Les relances suivent l’expiration des bonus. Aucun effet n’est redéclenché automatiquement.</small></div>
    <h3 className="combat-section-title">Passifs des objets équipés</h3>
    {passives.length ? <div className="combat-effect-grid">{passives.map(entry =>
      <PassiveCard key={entry.key} entry={entry} activation={state.passives[entry.key] || { enabled: false }} turn={state.turn} catalog={catalog}
        onChange={activation => onChange({ ...state, passives: { ...state.passives, [entry.key]: activation } })} />,
    )}</div> : <p className="combat-empty">Équipe un Dofus ou un objet à passif dans « Mon stuff » pour le retrouver ici. Les bonus permanents sont déjà comptés.</p>}
    <BoostPicker catalog={catalog} character={character} boosts={boosts} state={state} onChange={onChange} />
    {Object.values(context.bonuses).some(value => value !== 0) && <div className="combat-active-summary"><strong>Bonus appliqués à cet aperçu</strong><BonusList stats={context.bonuses} catalog={catalog} /></div>}
    <p className="combat-preview-scope">Ces passifs et boosts concernent la prévisualisation. Les réglages de la fiche d’un sort sont conservés séparément dans ses objectifs de recherche.</p>
    </>}
  </section>;
}
