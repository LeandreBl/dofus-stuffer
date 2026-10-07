import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { defaultCombatPreview, getPreviewBoosts, getPreviewBoostBonuses, getPreviewPassives, getPreviewPassiveBonuses, getSpellLevel,
  type Build, type Catalog, type Character, type CombatPreviewContext, type CombatPreviewState, type Stats } from "@dofus/shared";
import { fmt, GameImage, plainText, SearchField, StatIcon, statUnit } from "./ui";

const PREVIEW_KEY = "dofus-stuffer.combat-preview.v1";
const bonusNames: Record<string, string> = { dealtDamageMultiplier: "dommages finaux", dealtDamageMultiplierMelee: "dommages en mêlée",
  dealtDamageMultiplierDistance: "dommages à distance", dealtDamageMultiplierWeapon: "dommages d’armes", dealtDamageMultiplierSpells: "dommages de sorts", weaponPower: "Puissance Armes" };
const descriptionText = (description: string) => plainText(description.replace(/\{\{(?:spell|item),[^:]+::([^}]+)\}\}/g, "$1")).trim();
export function loadCombatPreview(): CombatPreviewState {
  try {
    const state = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null");
    if (state && typeof state.turn === "number" && state.passives && typeof state.passives === "object"
      && !Array.isArray(state.passives) && state.boosts && typeof state.boosts === "object" && !Array.isArray(state.boosts)) return state;
  } catch { /* Unavailable storage or an old malformed preview starts cleanly. */ }
  return defaultCombatPreview();
}
export function saveCombatPreview(state: CombatPreviewState) {
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(state)); } catch { /* The preview also works without persistent storage. */ }
}
function Stepper({ label, value, min = 1, max, step = 1, shortcuts = [], onChange }: {
  label: string; value: number; min?: number; max: number; step?: number; shortcuts?: number[]; onChange: (value: number) => void;
}) {
  return <div className="combat-stepper-row"><span>{label}</span><div className="combat-stepper">
    <button className="icon-button" aria-label={`Réduire ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Minus size={13} /></button>
    <output aria-label={label}>{value}</output>
    <button className="icon-button" aria-label={`Augmenter ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Plus size={13} /></button>
  </div>{shortcuts.map(number => <button key={number} className={`combat-shortcut ${value === number ? "active" : ""}`}
    aria-label={`${label} : ${number}`} onClick={() => onChange(number)}>{number}</button>)}</div>;
}
function BonusList({ stats, catalog }: { stats: Stats; catalog: Catalog }) {
  return <div className="combat-bonus-list">{Object.entries(stats).filter(([, value]) => value !== 0).map(([key, value]) => {
    const stat = catalog.stats.find(stat => stat.key === key);
    return <span key={key}><StatIcon stat={stat} />{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat) ? ` ${statUnit(stat)}` : ""} {bonusNames[key] || stat?.name || key}</span>;
  })}</div>;
}
export function CombatPreviewPanel({ catalog, build, character, state, context, onChange }: {
  catalog: Catalog; build: Build; character: Character; state: CombatPreviewState; context: CombatPreviewContext; onChange: (state: CombatPreviewState) => void;
}) {
  const passives = useMemo(() => getPreviewPassives(catalog, build), [catalog, build]);
  const boosts = useMemo(() => getPreviewBoosts(catalog, character), [catalog, character]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState(String(character.classId));
  const shown = boosts.filter(boost => (classFilter === "all" || !boost.spell.classIds.length || boost.spell.classIds.includes(Number(classFilter)))
    && plainText(boost.spell.name).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(search.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()));
  const activeBoosts = boosts.filter(boost => state.boosts[String(boost.spell.id)]?.enabled);
  const visibleBoosts = [...activeBoosts, ...shown.filter(boost => !state.boosts[String(boost.spell.id)]?.enabled)];
  const activeCount = passives.filter(passive => state.passives[passive.key]?.enabled && passive.status !== "unsupported").length + activeBoosts.length;
  return <section className="panel combat-preview-panel" aria-label="Passifs et boosts de la prévisualisation">
    <div className="panel-head"><div><h2><Sparkles size={18} /> Passifs & boosts</h2><p>Choisis les effets déjà actifs sur ton personnage.</p></div>
      <div className="combat-preview-actions"><span className="counter">{activeCount} actif{activeCount > 1 ? "s" : ""}</span>
        <button className="icon-button" aria-label="Réinitialiser les passifs et boosts" title="Tout désactiver" onClick={() => onChange(defaultCombatPreview())}><RotateCcw size={15} /></button></div></div>
    <div className="combat-turn-row"><Stepper label="Tour de combat" value={state.turn} max={999} shortcuts={[1, 2, 3, 4]} onChange={turn => onChange({ ...state, turn })} />
      <small>Les relances suivent l’expiration des bonus. Aucun effet n’est redéclenché automatiquement.</small></div>
    <h3 className="combat-section-title">Passifs des objets équipés</h3>
    {passives.length ? <div className="combat-effect-grid">{passives.map(entry => {
      const activation = state.passives[entry.key] || { enabled: false };
      const disabled = entry.status === "unsupported";
      const value = activation.value ?? entry.parameter?.defaultValue ?? 1;
      const change = (changes: Partial<typeof activation>) => onChange({ ...state, passives: { ...state.passives, [entry.key]: { ...activation, ...changes } } });
      return <div key={entry.key} role="group" aria-label={`${entry.item.name} · ${entry.label}`} className={`combat-effect-card ${activation.enabled && !disabled ? "active" : ""} ${disabled ? "unavailable" : ""}`}>
        <label className="combat-effect-toggle"><GameImage src={entry.item.icon} /><span><strong>{entry.item.name}</strong><small>{entry.label}</small></span>
          <input type="checkbox" aria-label={`Activer ${entry.item.name} · ${entry.label}`} checked={activation.enabled && !disabled} disabled={disabled} onChange={event => change({ enabled: event.target.checked })} /></label>
        <BonusList stats={getPreviewPassiveBonuses(entry, state.turn, value)} catalog={catalog} />
        {activation.enabled && entry.parameter && <Stepper {...entry.parameter} value={value} onChange={value => change({ value })} />}
        {activation.enabled && entry.duration && <label className="combat-duration">Tours restants<select aria-label={`Tours restants · ${entry.item.name} · ${entry.label}`} value={activation.remainingTurns ?? entry.duration} onChange={event => change({ remainingTurns: Number(event.target.value) })}>
          {Array.from({ length: Math.min(20, entry.duration) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}
        {entry.note && <p className="combat-effect-note">{entry.note}</p>}
        {entry.passive.description && <details className="combat-effect-description"><summary>Conditions du passif <ChevronDown size={12} /></summary><p>{descriptionText(entry.passive.description)}</p></details>}
      </div>;
    })}</div> : <p className="combat-empty">Équipe un Dofus ou un objet à passif dans « Mon stuff » pour le retrouver ici. Les bonus permanents sont déjà comptés.</p>}
    <details className="combat-boost-picker" open>
      <summary className="combat-section-title">Sorts de boost <ChevronDown size={14} /></summary>
      <div className="catalog-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Trouver un boost…" />
        <select aria-label="Classe des boosts" value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="all">Toutes les classes</option>{catalog.classes.map(gameClass => <option key={gameClass.id} value={gameClass.id}>{gameClass.name}</option>)}</select></div>
      <p className="combat-effect-note">Les boosts de ta classe et les sorts communs sont proposés. Choisis une autre classe pour simuler un boost reçu d’un allié de ton niveau.</p>
      <div className="combat-effect-grid combat-boost-list">{visibleBoosts.map(boost => {
        const key = String(boost.spell.id), activation = state.boosts[key] || { enabled: false };
        const change = (changes: Partial<typeof activation>) => onChange({ ...state, boosts: { ...state.boosts, [key]: { ...activation, ...changes } } });
        return <div className={`combat-effect-card ${activation.enabled ? "active" : ""}`} key={key}>
          <label className="combat-effect-toggle"><GameImage src={boost.spell.icon} /><span><strong>{boost.spell.name}</strong><small>Niveau {getSpellLevel(boost.spell, character.level)?.minPlayerLevel} · bonus du sort déjà lancé</small></span>
            <input type="checkbox" aria-label={`Activer le boost ${boost.spell.name}`} checked={activation.enabled} onChange={event => change({ enabled: event.target.checked })} /></label>
          <BonusList stats={getPreviewBoostBonuses(boost, !!activation.critical)} catalog={catalog} />
          {activation.enabled && <div className="combat-boost-controls">
            {boost.criticalEffects.length > 0 && <div className="segment" aria-label={`Lancer du boost ${boost.spell.name}`}>{([false, true] as const).map(critical => <button key={String(critical)} className={!!activation.critical === critical ? "active" : ""} aria-pressed={!!activation.critical === critical} onClick={() => change({ critical })}>{critical ? "Boost critique" : "Boost normal"}</button>)}</div>}
            {boost.maxStacks > 1 && <Stepper label={`Cumuls de ${boost.spell.name}`} value={activation.stacks ?? 1} max={boost.maxStacks} shortcuts={[1, boost.maxStacks]} onChange={stacks => change({ stacks })} />}
            <label className="combat-duration">Lancé il y a<select aria-label={`Ancienneté du boost ${boost.spell.name}`} value={activation.age ?? 0} onChange={event => change({ age: Number(event.target.value) })}>
              {Array.from({ length: Math.min(20, boost.duration) + 1 }, (_, age) => <option key={age} value={age}>{age === 0 ? "Ce tour" : `${age} tour${age > 1 ? "s" : ""}`}</option>)}</select></label>
          </div>}
          {activation.enabled && (activation.age ?? 0) >= boost.duration && <p className="combat-effect-note">Boost expiré : aucun bonus appliqué à cet aperçu.</p>}
          <details className="combat-effect-description"><summary>Effets et conditions <ChevronDown size={12} /></summary><p>{descriptionText(boost.spell.description)}</p><p>Seuls les bonus de caractéristiques listés sont appliqués. Les dégâts du lancement, déplacements, états et effets dépendant d’une cible ne sont pas simulés ici.</p></details>
        </div>;
      })}</div>
      {!visibleBoosts.length && <p className="combat-empty">Aucun boost calculable avec ces filtres et ce niveau.</p>}
    </details>
    {Object.values(context.bonuses).some(value => value !== 0) && <div className="combat-active-summary"><strong>Bonus appliqués à cet aperçu</strong><BonusList stats={context.bonuses} catalog={catalog} /></div>}
    <p className="combat-preview-scope">Ces passifs et boosts concernent la prévisualisation. Les réglages de la fiche d’un sort sont conservés séparément dans ses objectifs de recherche.</p>
  </section>;
}
