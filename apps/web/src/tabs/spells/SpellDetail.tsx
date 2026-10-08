import { Clock3, Crosshair, Info, Plus } from "lucide-react";
import { getPreviewBoosts, type Catalog, type Spell, type SpellLevel, type SpellScenario } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { SpellScenarioPanel } from "../../constraints/SpellScenarioPanel";
import { fmt, plainText } from "../../lib/format";
import type { PreviewSpellDamage } from "./damage";
import { RecastTable } from "./RecastTable";
import { SpellDamageColumns } from "./SpellDamageColumns";
import { SpellImage } from "./SpellImage";
import { spellClasses } from "./SpellSummary";
import { SupportColumns } from "./SupportColumns";

export function SpellDetail({ catalog, spell, level, damage, support, scenario, currentTurn, onScenario, onAdd }: {
  catalog: Catalog;
  spell: Spell;
  level: SpellLevel;
  damage: PreviewSpellDamage;
  /** Boost shown instead of damage for a support spell. */
  support?: { boost?: ReturnType<typeof getPreviewBoosts>[number] };
  scenario?: SpellScenario;
  currentTurn: number;
  onScenario: (scenario: SpellScenario) => void;
  onAdd: () => void;
}) {
  return (
    <section className="panel spell-detail">
      <div className="spell-detail-heading">
        <SpellImage spell={spell} level={level} catalog={catalog} />
        <div>
          <h2>{spell.name}</h2>
          <small>
            {spellClasses(spell, catalog)} · Rang {level.grade} · Niveau {level.minPlayerLevel}
          </small>
        </div>
      </div>
      <div className="spell-meta">
        <span>
          <StatIcon stat={catalog.stats.find((stat) => stat.key === "actionPoints")} />
          {level.apCost} PA
        </span>
        <span>
          <Crosshair size={13} />
          {level.minRange} – {level.range} PO
          {level.rangeCanBeBoosted ? " modifiable" : ""}
        </span>
        <span>
          <StatIcon stat={catalog.stats.find((stat) => stat.key === "criticalHit")} />
          {fmt(damage.critChance)} % critique
        </span>
        <span>
          <Clock3 size={13} />
          {level.minCastInterval ? `Relance ${level.minCastInterval} tours` : `${level.maxCastPerTurn || "∞"} / tour`}
        </span>
      </div>
      <p className="spell-description">{plainText(spell.description)}</p>
      {support ? (
        <SupportColumns catalog={catalog} spell={spell} level={level} boost={support.boost} />
      ) : <>
        <SpellScenarioPanel spell={spell} damage={damage} value={scenario ?? {}} onChange={onScenario} />
        {scenario?.summonSpellId && <p className="inline-notice">Attaque prévisualisée : <strong>{damage.summonAttacks?.find((attack) => attack.id === scenario.summonSpellId)?.name}</strong> · {damage.apCost} PA · {fmt(damage.critChance)} % critique.</p>}
        {!damage.supported && (
          <div className="notice warning" style={{ marginBottom: 18 }}>
            <Info size={17} />
            <div>
              Cette mécanique n’est pas entièrement simulée. Les dégâts ne
              sont pas validés et ne peuvent pas garantir une contrainte
              obligatoire.
              {damage.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </div>
          </div>
        )}
        <SpellDamageColumns catalog={catalog} damage={damage} />
        {damage.supported && (!!level.minCastInterval || damage.turns.some((turn) => turn.bonus)) && (
          <RecastTable damage={damage} currentTurn={currentTurn} />
        )}
      </>}
      <div className="spell-priority-actions">
        <button className="button primary" onClick={onAdd}>
          <Plus size={15} /> Définir mes objectifs de sort
        </button>
      </div>
      <p className="inline-notice">{support ? "Chance de critique : vise une cible ou maximise-la." : "Dégâts et chance de critique : vise une cible ou maximise les deux."}</p>
      {!support && damage.supported && damage.warnings.length > 0 && (
        <p className="inline-notice">{damage.warnings.join(" · ")}</p>
      )}
      <details className="target-settings">
        <summary>
          <Info size={14} /> Effets issus du jeu
        </summary>
        <p className="inline-notice">
          {level.effects
            .map((effect) => plainText(effect.description || `Effet ${effect.effectId}`))
            .join(" · ") || "Aucun effet direct."}
        </p>
      </details>
    </section>
  );
}
