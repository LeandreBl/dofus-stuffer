import type { Catalog, RawEffect, Spell, SpellLevel } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { weaponEffectText } from "../../lib/effect-text";
import { plainText } from "../../lib/format";

/** Game-like spell tooltip: base values, as the in-game grimoire shows them. */
export function SpellSummary({ spell, level, catalog }: { spell: Spell; level: SpellLevel; catalog: Catalog }) {
  const lines = (effects: RawEffect[]) => effects.filter((effect) => effect.visibleInTooltip !== false && effect.description)
    .map((effect, index) => <p key={index}>{weaponEffectText(effect, catalog)}{effect.duration ? ` (${effect.duration} tour${effect.duration > 1 ? "s" : ""})` : ""}</p>);
  const normal = lines(level.effects), critical = lines(level.criticalEffects);
  return <>
    <div className="item-hover-heading"><GameImage src={spell.icon} /><div>
      <h3>{spell.name}</h3><p>{spellClasses(spell, catalog)} · Rang {level.grade} · Niveau {level.minPlayerLevel}</p>
    </div></div>
    <p>{level.apCost} PA · {level.minRange}–{level.range} PO{level.rangeCanBeBoosted ? " modifiable" : ""} · {level.criticalHitProbability} % critique</p>
    <p>{level.minCastInterval ? `Relance ${level.minCastInterval} tours` : `${level.maxCastPerTurn || "∞"} / tour`}{level.maxCastPerTarget ? ` · ${level.maxCastPerTarget} / cible` : ""}</p>
    {!!normal.length && <section><h4>Effets</h4>{normal}</section>}
    {!!critical.length && <section><h4>Coup critique</h4>{critical}</section>}
    {!!spell.description && <section><p>{plainText(spell.description)}</p></section>}
  </>;
}

export const spellClasses = (spell: Spell, catalog: Catalog) =>
  spell.classIds.map((id) => catalog.classes.find((gameClass) => gameClass.id === id)?.name).filter(Boolean).join(" · ") || "Sort commun";
