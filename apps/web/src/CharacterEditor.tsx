import { Fragment } from "react";
import { Info, Minus, Plus, RotateCcw, WandSparkles } from "lucide-react";
import { CHARACTER_STATS, characterPointCost, getCharacterAllocation, type Catalog, type Character, type Stats } from "@dofus/shared";
import { fmt, StatIcon } from "./ui";

const characterStats = CHARACTER_STATS;

export function CharacterEditor({ catalog, character, onChange, proposedStats }: {
  catalog: Catalog;
  character: Character;
  onChange: (character: Character) => void;
  proposedStats?: Stats;
}) {
  const automatic = character.allocationMode !== "manual";
  const displayedBase = automatic ? proposedStats || {} : character.baseStats;
  const allocation = getCharacterAllocation({ ...character, allocationMode: "manual", baseStats: displayedBase });
  const scrollValidation = getCharacterAllocation({ ...character, baseStats: {}, allocationMode: "manual" });
  const updateBase = (key: string, value: number) => {
    const requested = Math.max(0, Math.min(995, Math.floor(Number.isFinite(value) ? value : 0)));
    const otherCost = characterStats.filter((entry) => entry !== key).reduce(
      (sum, entry) => sum + characterPointCost(entry, character.baseStats[entry] || 0), 0,
    );
    let affordable = requested;
    while (affordable > 0 && characterPointCost(key, affordable) > allocation.available - otherCost) affordable--;
    onChange({ ...character, baseStats: { ...character.baseStats, [key]: affordable } });
  };
  return (
    <div className="character-editor">
      <div className="character-editor-head">
        <div>
          <h3>{automatic ? "Mes points sont répartis automatiquement" : "Ma répartition manuelle"}</h3>
          <p>{automatic ? "Renseigne ton parchotage. Le moteur répartit les points avec ton stuff selon tes priorités." : "Points de niveau et parchotage, séparément."}</p>
        </div>
        <div className={`points-counter ${allocation.remaining < 0 ? "exceeded" : ""}`} aria-live="polite">
          <strong>{fmt(automatic && !proposedStats ? allocation.available : allocation.remaining)}</strong> {automatic && !proposedStats ? "points à répartir" : "points restants"}
        </div>
      </div>
      {automatic && proposedStats && allocation.remaining < 0 && <div className="notice" style={{ marginTop: 12 }}><Info size={15} /><span>La répartition du stuff affiché dépasse les points de ce niveau. Une nouvelle recherche la recalculera.</span></div>}
      {(!automatic && !allocation.valid || !scrollValidation.valid) && <div className="notice warning" style={{ marginTop: 12 }} role="alert">
        <Info size={15} /><span>{(automatic ? scrollValidation : allocation).violations.join(" ")}</span>
      </div>}
      <div className="character-grid">
        <span className="character-grid-label">CARACTÉRISTIQUE</span>
        <span className="character-grid-label">{automatic ? "BASE PROPOSÉE" : "BASE INVESTIE"}</span>
        <span className="character-grid-label">PARCHOTAGE</span>
        {characterStats.map((key) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          const value = displayedBase[key] || 0;
          const scroll = character.scrollStats?.[key] || 0;
          const otherCost = allocation.spent - characterPointCost(key, value);
          const canAfford = (next: number) => otherCost + characterPointCost(key, next) <= allocation.available;
          const milestones = key === "vitality" ? [0, 100, 300, 500] : [0, 100, 200, 300];
          return <Fragment key={key}>
            <div className="character-stat"><StatIcon stat={stat} /><span>{stat?.name || key}{(!automatic || proposedStats) && <small>{fmt(characterPointCost(key, value))} points investis</small>}</span></div>
            {automatic ? <div className="proposed-allocation" aria-label={`Base proposée ${stat?.name || key}`}><strong>{proposedStats ? fmt(value) : "—"}</strong><small>{proposedStats ? "stuff affiché" : "après la recherche"}</small></div> : <div className="allocation-controls">
              <div className="allocation-stepper">
                <button aria-label={`Retirer 10 ${stat?.name || key}`} disabled={value === 0} onClick={() => updateBase(key, value - 10)}><Minus size={11} /></button>
                <input type="number" min="0" max="995" step="1" aria-label={`Base ${stat?.name || key}`} value={value} onChange={(event) => updateBase(key, Number(event.target.value))} />
                <button aria-label={`Ajouter 10 ${stat?.name || key}`} disabled={!canAfford(value + 1)} onClick={() => updateBase(key, value + 10)}><Plus size={11} /></button>
              </div>
              <div className="allocation-presets">{milestones.map((preset) => <button key={preset} className={value === preset ? "active" : ""} disabled={!canAfford(preset)} aria-label={`Investir ${preset} en ${stat?.name || key}`} onClick={() => updateBase(key, preset)}>{preset}</button>)}</div>
            </div>}
            <div className="allocation-controls">
              <div className="allocation-stepper"><input type="number" min="0" max="100" step="1" aria-label={`Parchotage ${stat?.name || key}`} value={scroll} onChange={(event) => onChange({ ...character, scrollStats: { ...character.scrollStats, [key]: Math.max(0, Math.min(100, Math.floor(Number(event.target.value)))) } })} /></div>
              <div className="parchment-presets">{[0, 25, 50, 100].map((preset) => <button key={preset} className={scroll === preset ? "active" : ""} aria-label={`Parchoter ${stat?.name || key} à ${preset}`} onClick={() => onChange({ ...character, scrollStats: { ...character.scrollStats, [key]: preset } })}>{preset}</button>)}</div>
            </div>
          </Fragment>;
        })}
      </div>
      <div className="character-editor-footer">
        <p className="character-rule">{automatic && !proposedStats ? `${fmt(allocation.available)} points disponibles` : `${fmt(allocation.spent)} / ${fmt(allocation.available)} points`} · 5 par niveau gagné</p>
        <div className="profile-actions">
          <button className="button ghost small" onClick={() => onChange({ ...character, scrollStats: {} })}>Sans parcho</button>
          <button className="button ghost small" onClick={() => onChange({ ...character, scrollStats: Object.fromEntries(characterStats.map((key) => [key, 100])) })}>Tout parcho 100</button>
        </div>
      </div>
      <details className="allocation-options">
        <summary>Options avancées de répartition</summary>
        <div className="segment" aria-label="Répartition des points de base">
          <button className={automatic ? "active" : ""} onClick={() => onChange({ ...character, allocationMode: "automatic", baseStats: {} })}><WandSparkles size={12} /> Automatique</button>
          <button className={!automatic ? "active" : ""} onClick={() => { if (automatic) onChange({ ...character, allocationMode: "manual", baseStats: proposedStats || character.baseStats }); }}>Choisir manuellement</button>
        </div>
        {!automatic && <button className="button ghost small" onClick={() => onChange({ ...character, baseStats: {} })}><RotateCcw size={11} /> Réinitialiser mes points</button>}
        <p className="character-rule" style={{ marginTop: 10 }}>Force, intelligence, chance, agilité : 1 point jusqu’à 100, puis 2 jusqu’à 200, 3 jusqu’à 300 et 4 au-delà. Vitalité : 1 pour 1. Sagesse : 3 pour 1. Le parchotage ne consomme pas tes points.</p>
      </details>
    </div>
  );
}
