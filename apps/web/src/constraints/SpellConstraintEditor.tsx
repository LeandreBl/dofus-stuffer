import { useState } from "react";
import { Check, Plus, SlidersHorizontal, Sparkles, Swords } from "lucide-react";
import { calculateSpellDamage, defaultTarget, type Constraint } from "@dofus/shared";
import { Modal } from "../components/Modal";
import { uid } from "../lib/format";
import { ConstraintFields } from "./ConstraintFields";
import { savedCriterion, type EditorActions, type EditorContext } from "./criteria";
import { CriterionIcon } from "./CriterionIcon";
import { SpellScenarioPanel } from "./SpellScenarioPanel";

export function SpellConstraintEditor({
  criterion, constraints, onSave, onClose, ...context
}: EditorContext & EditorActions & { criterion: Constraint; constraints: Constraint[] }) {
  const [pair, setPair] = useState(() => {
    const chanceFirst = criterion.metric === "criticalChance";
    const sameSpell = constraints.filter((entry) => entry.kind === criterion.kind && (criterion.kind === "weapon" || entry.spellId === criterion.spellId));
    const previous = sameSpell.find((entry) => entry.id === criterion.id) || sameSpell.find((entry) =>
      chanceFirst ? entry.metric === "criticalChance" : entry.metric !== "criticalChance" &&
        (entry.metric || "average") === (criterion.metric || "average") &&
        (entry.mode || "normal") === (criterion.mode || "normal") &&
        (entry.turnOffset || 0) === (criterion.turnOffset || 0),
    ) || criterion;
    const primary=criterion.scenario && criterion.metric!=='criticalChance' ? {...previous,scenario:criterion.scenario} : previous;
    const complement = sameSpell.find((entry) => (entry.metric === "criticalChance") !== chanceFirst);
    const newComplement: Constraint = {
      id: uid(), kind: criterion.kind, spellId: criterion.kind === "spell" ? criterion.spellId : undefined,
      priority: primary.priority, relation: "atLeast", strict: false,
      target: chanceFirst ? 1000 : 75,
      metric: chanceFirst ? "min" : "criticalChance",
      mode: chanceFirst ? "critical" : undefined,
      turnOffset: chanceFirst && criterion.kind === "spell" ? 0 : undefined,
    };
    return {
      damage: chanceFirst ? complement || newComplement : primary,
      chance: chanceFirst ? primary : complement || newComplement,
      damageEnabled: !chanceFirst || !!complement,
      chanceEnabled: chanceFirst || !!complement,
    };
  });
  const spell = context.catalog.spells.find((entry) => entry.id === criterion.spellId);
  const count = Number(pair.damageEnabled) + Number(pair.chanceEnabled);
  return (
    <Modal title={criterion.kind === "weapon" ? "Objectifs de l’arme équipée" : spell?.name || "Objectifs du sort"} onClose={onClose} icon={<CriterionIcon catalog={context.catalog} criterion={criterion} weapon={context.weapon} />} wide>
      <p>Combine les dégâts et la chance de critique {criterion.kind === "weapon" ? "de l’arme" : "de ce sort"}. Chaque objectif garde sa propre cible et sa place dans tes priorités.</p>
      {criterion.kind === "weapon" && <div className="notice weapon-objective-note"><Swords size={16} /><div>La recherche calcule ces objectifs avec l’arme de chaque stuff candidat.{context.weapon ? ` Actuellement : ${context.weapon.name}.` : " Tu peux définir ces objectifs avant d’équiper une arme."} Pour garder une arme précise, verrouille-la dans Mon stuff.</div></div>}
      <div className="spell-objectives-grid">
        {(["damage", "chance"] as const).map((key) => {
          const enabledKey = key === "damage" ? "damageEnabled" : "chanceEnabled";
          const enabled = pair[enabledKey];
          const chance = key === "chance";
          return (
            <section className={`spell-objective-panel ${enabled ? "enabled" : ""}`} key={key}>
              <label className="spell-objective-heading">
                {chance ? <Sparkles size={18} /> : <Swords size={18} />}
                <span><strong>{chance ? "Chance de critique" : "Dégâts"}</strong><small>{chance ? "La fréquence des coups critiques" : "La force de chaque coup"}</small></span>
                <input type="checkbox" aria-label={chance ? "Viser la chance de critique" : "Viser les dégâts"} checked={enabled} onChange={(event) => setPair((value) => ({ ...value, [enabledKey]: event.target.checked }))} />
              </label>
              {enabled ? (
                <ConstraintFields draft={pair[key]} onChange={(draft) => setPair((value) => ({ ...value, [key]: draft }))} {...context} />
              ) : (
                <button className="button ghost wide spell-enable-objective" onClick={() => setPair((value) => ({ ...value, [enabledKey]: true }))}>
                  <Plus size={15} /> {chance ? "Ajouter une cible de critique" : "Ajouter une cible de dégâts"}
                </button>
              )}
            </section>
          );
        })}
      </div>
      {spell && pair.damageEnabled && <details className="target-settings"><summary><SlidersHorizontal size={14}/> Situation de calcul enregistrée</summary><SpellScenarioPanel spell={spell} damage={calculateSpellDamage(spell,context.stats,defaultTarget(),context.characterLevel,{catalog:context.catalog,scenario:pair.damage.scenario})} value={pair.damage.scenario??{}} onChange={scenario=>setPair(current=>({...current,damage:{...current.damage,scenario}}))}/></details>}
      <p className="inline-notice">Tu peux, par exemple, maximiser les dégâts avec au moins 75 % de critique, ou maximiser les deux. Les nouveaux objectifs partagent le même niveau de priorité ; tu pourras ensuite les déplacer séparément.</p>
      <div className="modal-actions">
        <button className="button ghost" onClick={onClose}>Annuler</button>
        <button className="button primary" disabled={!count} onClick={() => onSave([
          ...(pair.damageEnabled ? [savedCriterion(pair.damage)] : []),
          ...(pair.chanceEnabled ? [savedCriterion(pair.chance)] : []),
        ], [pair.damage.id, pair.chance.id])}>
          <Check size={15} /> {count === 2 ? "Enregistrer les deux objectifs" : "Enregistrer l’objectif"}
        </button>
      </div>
    </Modal>
  );
}
