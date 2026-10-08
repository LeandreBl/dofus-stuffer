import { useEffect, useMemo, useState } from "react";
import { Swords, WandSparkles } from "lucide-react";
import {
  calculatePreviewSpellDamage,
  createCombatPreviewContext,
  getPreviewBoosts,
  getSpellLevel,
  type BuildEvaluation,
  type Catalog,
  type Constraint,
  type OptimizationRequest,
} from "@dofus/shared";
import { uid } from "../../lib/format";
import { CombatPreviewPanel } from "./combat/CombatPreviewPanel";
import { loadCombatPreview, saveCombatPreview } from "./combat/combat-preview-storage";
import { Grimoire } from "./Grimoire";
import { SpellDetail } from "./SpellDetail";
import { SpellsNotices } from "./SpellsNotices";
import { TargetSettings } from "./TargetSettings";
import { useGrimoire } from "./useGrimoire";
import { useSpellScenarios } from "./useSpellScenarios";
import { WeaponPreview } from "./WeaponPreview";

export function SpellsTab({
  catalog,
  request,
  evaluation,
  onChange,
  onAdd,
  onWeapon,
  initialSpellId,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  evaluation: BuildEvaluation;
  onChange: (request: OptimizationRequest) => void;
  onAdd: (constraint: Constraint) => void;
  onWeapon: () => void;
  initialSpellId?: number;
}) {
  const [combatState, setCombatState] = useState(loadCombatPreview);
  useEffect(() => saveCombatPreview(combatState), [combatState]);
  const [scenarios, setScenarios] = useSpellScenarios();
  const combatContext = useMemo(() => createCombatPreviewContext(catalog, evaluation.build, request.character, evaluation.stats, combatState),
    [catalog, evaluation.build, request.character, evaluation.stats, combatState]);
  const grimoire = useGrimoire(catalog, request.character, initialSpellId);
  const { spells, limit, selected, view, setView } = grimoire;
  const damages = useMemo(
    () => new Map(spells.slice(0, limit).map((spell) => [
      spell.id,
      calculatePreviewSpellDamage(spell, request.character, request.target, combatContext, scenarios[spell.id]),
    ])),
    [spells, limit, combatContext, request.target, request.character, scenarios],
  );
  const damage = useMemo(
    () => selected ? calculatePreviewSpellDamage(selected, request.character, request.target, combatContext, scenarios[selected.id]) : undefined,
    [selected, combatContext, request.target, request.character, scenarios],
  );
  const level = selected && getSpellLevel(selected, request.character.level);
  // Support spells show what they grant instead of damage and recasts.
  const support = !!selected && damage?.damageKind === "support" && !grimoire.spellElements.get(selected.id)?.length;
  const add = () => {
    if (selected)
      onAdd({
        id: uid(),
        kind: "spell",
        spellId: selected.id,
        target: 1000,
        relation: "atLeast",
        priority: 0,
        strict: false,
        mode: damage?.critical ? "critical" : "normal",
        metric: "min",
        turnOffset: 0,
        scenario: scenarios[selected.id],
      });
  };
  return (
    <>
      <SpellsNotices evaluation={evaluation} />
      <TargetSettings catalog={catalog} target={request.target} onChange={(changes) => onChange({ ...request, target: { ...request.target, ...changes } })} />
      <CombatPreviewPanel catalog={catalog} build={evaluation.build} character={request.character} state={combatState} context={combatContext} onChange={setCombatState} />
      <div className="segment damage-view-tabs" role="tablist" aria-label="Type de dégâts">
        <button role="tab" aria-selected={view === "spells"} className={view === "spells" ? "active" : ""} onClick={() => setView("spells")}><WandSparkles size={14} /> Sorts</button>
        <button role="tab" aria-selected={view === "weapon"} className={view === "weapon" ? "active" : ""} onClick={() => setView("weapon")}><Swords size={14} /> Corps à corps</button>
      </div>
      {view === "weapon" && <WeaponPreview catalog={catalog} request={request} evaluation={evaluation} context={combatContext} onAdd={onAdd} onWeapon={onWeapon} />}
      {view === "spells" && <div className="spell-page-grid">
        <Grimoire catalog={catalog} characterLevel={request.character.level} grimoire={grimoire} damages={damages} />
        {selected && damage && level ? (
          <SpellDetail
            catalog={catalog}
            spell={selected}
            level={level}
            damage={damage}
            support={support ? { boost: getPreviewBoosts({ ...catalog, spells: [selected] }, request.character)[0] } : undefined}
            scenario={scenarios[selected.id]}
            currentTurn={combatState.turn}
            onScenario={(value) => setScenarios((current) => ({ ...current, [selected.id]: value }))}
            onAdd={add}
          />
        ) : (
          <div className="empty-state">
            <Swords size={24} />
            <p>{spells.length ? "Sélectionne un sort disponible à ton niveau." : "Aucun sort à afficher avec ces filtres."}</p>
          </div>
        )}
      </div>}
    </>
  );
}
