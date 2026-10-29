import { Fragment } from "react";
import { Info } from "lucide-react";
import { CHARACTER_STATS, getCharacterAllocation, type Catalog, type Character, type Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";

const characterStats = CHARACTER_STATS;

/** Scrolls only: the engine always spends the level's characteristic points (edited afterwards in "Mon stuff"). */
export function CharacterEditor({ catalog, character, onChange, proposedStats }: {
  catalog: Catalog;
  character: Character;
  onChange: (character: Character) => void;
  proposedStats?: Stats;
}) {
  const allocation = getCharacterAllocation({ ...character, baseStats: proposedStats || {} });
  const scrollValidation = getCharacterAllocation({ ...character, baseStats: {} });
  const scrollAll = (value: number) => onChange({ ...character, scrollStats: value ? Object.fromEntries(characterStats.map((key) => [key, value])) : {} });
  const scrolledAll = characterStats.every((key) => character.scrollStats?.[key] === 100);
  const scrolledNone = characterStats.every((key) => !character.scrollStats?.[key]);
  const setScroll = (key: string, value: number) => onChange({ ...character, scrollStats: { ...character.scrollStats, [key]: Math.max(0, Math.min(100, Math.floor(value) || 0)) } });
  return (
    <div className="character-editor">
      <div className="character-editor-head">
        <div>
          <h3>Mon parchotage</h3>
          <p>{`Le moteur répartit tes ${fmt(allocation.available)} points avec ton stuff selon tes priorités. Tu peux les retoucher ensuite dans « Mon stuff ».`}</p>
        </div>
        <div className="segment" aria-label="Parchotage">
          <button className={scrolledAll ? "active" : ""} onClick={() => scrollAll(100)}>Parchoté 100</button>
          <button className={scrolledNone ? "active" : ""} onClick={() => scrollAll(0)}>Sans parcho</button>
        </div>
      </div>
      {proposedStats && allocation.remaining < 0 && <div className="notice" style={{ marginTop: 12 }}><Info size={15} /><span>La répartition du stuff affiché dépasse les points de ce niveau. Une nouvelle recherche la recalculera.</span></div>}
      {!scrollValidation.valid && <div className="notice warning" style={{ marginTop: 12 }} role="alert">
        <Info size={15} /><span>{scrollValidation.violations.join(" ")}</span>
      </div>}
      <div className="character-grid scrolls-only">
        <span className="character-grid-label">CARACTÉRISTIQUE</span>
        <span className="character-grid-label">PARCHOTAGE</span>
        {characterStats.map((key) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          const scroll = character.scrollStats?.[key] || 0;
          return <Fragment key={key}>
            <div className="character-stat"><StatIcon stat={stat} /><span>{stat?.name || key}</span></div>
            <div className="allocation-controls">
              <div className="allocation-stepper"><input type="number" min="0" max="100" step="1" aria-label={`Parchotage ${stat?.name || key}`} value={scroll} onChange={(event) => setScroll(key, Number(event.target.value))} /></div>
              <div className="parchment-presets">{[0, 25, 50, 100].map((preset) => <button key={preset} className={scroll === preset ? "active" : ""} aria-label={`Parchoter ${stat?.name || key} à ${preset}`} onClick={() => setScroll(key, preset)}>{preset}</button>)}</div>
            </div>
          </Fragment>;
        })}
      </div>
    </div>
  );
}
