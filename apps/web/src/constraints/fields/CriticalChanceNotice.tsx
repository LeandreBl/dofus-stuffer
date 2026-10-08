import { Sparkles } from "lucide-react";
import { calculateSpellCriticalChance, calculateWeaponCriticalChance, getSpellLevel, type Constraint } from "@dofus/shared";
import { fmt } from "../../lib/format";
import type { EditorContext } from "../criteria";

/** Critical chance of the spell or weapon with the current equipment. */
export function CriticalChanceNotice({ draft, catalog, characterLevel, stats, weapon }: EditorContext & { draft: Constraint }) {
  const spell = catalog.spells.find((entry) => entry.id === draft.spellId);
  const spellLevel = spell && getSpellLevel(spell, characterLevel);
  const currentChance = draft.kind === "weapon" ? weapon ? calculateWeaponCriticalChance(weapon, stats, characterLevel) : null : spell ? calculateSpellCriticalChance(spell, stats, characterLevel) : null;
  const baseChance = draft.kind === "weapon" ? weapon?.weapon?.criticalHitProbability : spellLevel?.criticalHitProbability;
  return (
    <div className="notice spell-crit-context">
      <Sparkles size={17} />
      <div>
        {currentChance === null
          ? draft.kind === "weapon" ? weapon ? "La chance de critique de cette arme ne peut pas être calculée avec ces données ou à ce niveau." : "Équipe une arme pour prévisualiser sa chance de critique. La recherche vérifiera chaque arme candidate." : "Ce sort n’est pas disponible à ton niveau."
          : !baseChance
            ? `${draft.kind === "weapon" ? "Cette arme" : "Ce sort"} ne peut pas faire de coup critique : sa chance reste à 0 %.`
            : <><strong>Taux calculé avec ton stuff : {fmt(currentChance)} %</strong><br />{fmt(baseChance)} % de base + {fmt(stats.criticalHit || 0)} points de bonus critiques permanents, entre 0 et 100 %.</>}
        {currentChance !== null && !!baseChance && (
          <p className="inline-notice">Les bonus temporaires et effets spéciaux non simulés sont exclus.</p>
        )}
      </div>
    </div>
  );
}
