import { getPreviewBoostBonuses, getPreviewBoosts, type Catalog, type Spell, type SpellLevel } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { weaponEffectText } from "../../lib/effect-text";
import { BonusList } from "./combat/BonusList";

/** Support spells show what they grant instead of damage. */
export function SupportColumns({ catalog, spell, level, boost }: {
  catalog: Catalog;
  spell: Spell;
  level: SpellLevel;
  boost?: ReturnType<typeof getPreviewBoosts>[number];
}) {
  return (
    <div className="damage-columns">
      {(["normal", "critical"] as const).map((mode) => {
        const critical = mode === "critical";
        const bonuses = boost && (!critical || boost.criticalEffects.length) ? getPreviewBoostBonuses(boost, critical) : {};
        const effects = (critical ? level.criticalEffects : level.effects).filter((effect) => effect.visibleInTooltip !== false && effect.description);
        return (
          <div className={`damage-block ${mode}`} key={mode}>
            <label>
              <StatIcon stat={critical ? catalog.stats.find((stat) => stat.key === "criticalHit") : undefined} spell={critical ? undefined : spell} />
              {critical ? "Lancer critique" : "Lancer normal"}
            </label>
            {Object.values(bonuses).some(Boolean) ? (
              <BonusList stats={bonuses} catalog={catalog} />
            ) : effects.length ? (
              <div className="damage-lines">{effects.map((effect, index) => <span key={index}>{weaponEffectText(effect, catalog)}</span>)}</div>
            ) : (
              <small>{critical ? "Ce sort ne possède pas de coup critique." : "Aucun effet affiché par le jeu."}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}
