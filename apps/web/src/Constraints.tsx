import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Coins,
  GripVertical,
  Info,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateSpellCriticalChance,
  calculateSpellDamage,
  defaultTarget,
  calculateWeaponCriticalChance,
  canIncludePower,
  getSpellLevel,
  hasStatScalingSpellDamage,
  getStatConstraintValue,
  STAT_CAPS,
  type BuildEvaluation,
  type Catalog,
  type Constraint,
  type EquipmentItem,
  type OptimizationRequest,
  type Spell,
  type StatDefinition,
  type Stats,
} from "@dofus/shared";
import { fmt, GameImage, Modal, money, SearchField, StatIcon, statUnit, uid } from "./ui";
import { SpellScenarioPanel } from './SpellScenario';
import { withoutCreatureTarget } from './spell-scenario';

export function constraintName(
  catalog: Catalog,
  criterion: Constraint,
): string {
  return criterion.kind === "price"
    ? "Budget du stuff"
    : criterion.kind === "weapon"
      ? `Arme équipée · ${criterion.metric === "criticalChance" ? "Critique %" : "Dégâts"}`
    : criterion.kind === "spell"
      ? `${catalog.spells.find((spell) => spell.id === criterion.spellId)?.name || "Sort inconnu"} · ${criterion.metric === "criticalChance" ? "Critique %" : "Dégâts"}`
      : `${catalog.stats.find((stat) => stat.key === criterion.statKey)?.name || criterion.statKey || "Caractéristique"}${criterion.includePower && canIncludePower(criterion) ? " · avec puissance" : ""}`;
}
export function constraintTarget(criterion: Constraint): string {
  const relation = {
    atLeast: "Au moins",
    atMost: "Au plus",
    maximize: "Maximiser",
    minimize: "Minimiser",
  }[criterion.relation];
  if ((criterion.kind === "spell" || criterion.kind === "weapon") && criterion.metric === "criticalChance") {
    return `${relation}${["maximize", "minimize"].includes(criterion.relation) ? "" : ` ${fmt(criterion.target)} %`} · chance de critique`;
  }
  return `${relation}${["maximize", "minimize"].includes(criterion.relation) ? "" : ` ${criterion.kind === "price" ? money(criterion.target) : fmt(criterion.target)}`}${criterion.kind === "spell" || criterion.kind === "weapon" ? ` · ${criterion.mode === "critical" ? "critique" : "normal"} · ${(criterion.metric || "average") === "average" ? "moyenne" : criterion.metric === "max" ? "jet max." : "jet min."}${criterion.kind === "spell" && criterion.turnOffset ? ` · T+${criterion.turnOffset}` : ""}` : ""}`;
}
export function CriterionIcon({
  catalog,
  criterion,
  weapon,
}: {
  catalog: Catalog;
  criterion: Constraint;
  weapon?: EquipmentItem;
}) {
  if (criterion.kind === "weapon") return <span className="stat-icon">{weapon?.icon ? <GameImage src={weapon.icon} /> : <Swords size={19} />}</span>;
  return (
    <StatIcon
      price={criterion.kind === "price"}
      stat={catalog.stats.find((stat) => stat.key === criterion.statKey)}
      spell={catalog.spells.find((spell) => spell.id === criterion.spellId)}
    />
  );
}

export function ConstraintEditor({
  criterion,
  constraints,
  catalog,
  characterLevel,
  stats,
  weapon,
  onSave,
  onClose,
}: {
  criterion: Constraint;
  constraints: Constraint[];
  catalog: Catalog;
  characterLevel: number;
  stats: Stats;
  weapon?: EquipmentItem;
  onSave: (criteria: Constraint[], replacedIds: string[]) => void;
  onClose: () => void;
}) {
  const props = { catalog, characterLevel, stats, weapon, onSave, onClose };
  return criterion.kind === "spell" || criterion.kind === "weapon"
    ? <SpellConstraintEditor key={criterion.id} criterion={criterion} constraints={constraints} {...props} />
    : <SingleConstraintEditor key={criterion.id} criterion={criterion} {...props} />;
}

type EditorContext = {
  catalog: Catalog;
  characterLevel: number;
  stats: Stats;
  weapon?: EquipmentItem;
};
type EditorActions = {
  onSave: (criteria: Constraint[], replacedIds: string[]) => void;
  onClose: () => void;
};
const cappedCriterion = (draft: Constraint): Constraint => {
  const maximum = draft.kind === "stat" ? STAT_CAPS[draft.statKey || ""] : undefined;
  return maximum !== undefined && ["atLeast", "atMost"].includes(draft.relation)
    ? { ...draft, target: Math.min(maximum, draft.target) }
    : draft;
};
const savedCriterion = (draft: Constraint): Constraint => ({
  ...cappedCriterion(draft),
  strict: !["maximize", "minimize"].includes(draft.relation) && draft.strict,
  ...(draft.scenario ? { scenario: withoutCreatureTarget(draft.scenario) } : {}),
});

function SingleConstraintEditor({
  criterion, onSave, onClose, ...context
}: EditorContext & EditorActions & { criterion: Constraint }) {
  const [draft, setDraft] = useState(() => cappedCriterion(criterion));
  return (
    <Modal title={constraintName(context.catalog, draft)} onClose={onClose} icon={<CriterionIcon catalog={context.catalog} criterion={draft} />}>
      <p>Choisis ce que tu vises. Tu pourras ensuite déplacer ce critère dans ta liste de priorités.</p>
      <ConstraintFields draft={draft} onChange={setDraft} {...context} />
      <div className="modal-actions">
        <button className="button ghost" onClick={onClose}>Annuler</button>
        <button className="button primary" onClick={() => onSave([savedCriterion(draft)], [criterion.id])}>
          <Check size={15} /> Enregistrer
        </button>
      </div>
    </Modal>
  );
}

function SpellConstraintEditor({
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

function ConstraintFields({
  draft, onChange, catalog, characterLevel, stats, weapon,
}: EditorContext & { draft: Constraint; onChange: (draft: Constraint) => void }) {
  const stat = catalog.stats.find((entry) => entry.key === draft.statKey);
  const price = draft.kind === "price";
  const damageCriterion = draft.kind === "spell" || draft.kind === "weapon";
  const criticalChance = damageCriterion && draft.metric === "criticalChance";
  const powerAvailable = canIncludePower(draft);
  const spell = catalog.spells.find((entry) => entry.id === draft.spellId);
  const spellLevel = spell && getSpellLevel(spell, characterLevel);
  const currentChance = draft.kind === "weapon" ? weapon ? calculateWeaponCriticalChance(weapon, stats, characterLevel) : null : spell ? calculateSpellCriticalChance(spell, stats, characterLevel) : null;
  const baseChance = draft.kind === "weapon" ? weapon?.weapon?.criticalHitProbability : spellLevel?.criticalHitProbability;
  const scale = price ? 1_000_000 : 1;
  const statMaximum = draft.kind === "stat" ? STAT_CAPS[draft.statKey || ""] : undefined;
  const maximum = statMaximum ?? (criticalChance ? 100 : price ? 10_000_000_000 : 10_000_000);
  const step = criticalChance || (statMaximum !== undefined && statUnit(stat) === "%") ? 5 : scale * (price || draft.target < 20 ? 1 : 50);
  const short =
    draft.statKey === "actionPoints"
      ? [10, 11, 12]
      : draft.statKey === "movementPoints"
        ? [4, 5, 6]
        : draft.statKey === "range"
          ? [3, 4, 5, 6]
          : criticalChance
            ? [50, 75, 100]
          : damageCriterion
            ? [500, 1000, 1500, 2000]
            : price
              ? [5, 10, 20, 50, 100]
              : statUnit(stat) === "%"
                ? [10, 20, 30, 50]
                : [100, 300, 500, 1000];
  const update = (changes: Partial<Constraint>) =>
    onChange(cappedCriterion({ ...draft, ...changes }));
  const numeric = !["maximize", "minimize"].includes(draft.relation);
  return (
    <>
      <div className="segment" aria-label={damageCriterion ? criticalChance ? "Objectif de chance de critique" : "Objectif de dégâts" : "Objectif du critère"}>
        {(price
          ? ["atMost", "minimize"]
          : ["atLeast", "atMost", "maximize"]
        ).map((relation) => (
          <button
            key={relation}
            className={draft.relation === relation ? "active" : ""}
            onClick={() =>
              update({ relation: relation as Constraint["relation"] })
            }
          >
            {
              (
                {
                  atLeast: "Au moins",
                  atMost: "Au plus",
                  maximize: "Le plus possible",
                  minimize: "Le moins cher",
                } as Record<string, string>
              )[relation]
            }
          </button>
        ))}
      </div>
      {powerAvailable && <>
        <div className="check-field">
          <StatIcon stat={catalog.stats.find((entry) => entry.key === "damagePercent")} />
          <label htmlFor={`power-target-${draft.id}`}>
            Avec puissance
            <small>Ajoute la puissance permanente à cette caractéristique pour évaluer l’objectif.</small>
          </label>
          <input id={`power-target-${draft.id}`} type="checkbox" aria-label="Avec puissance" checked={!!draft.includePower}
            onChange={(event) => update({ includePower: event.target.checked })} />
        </div>
        <p className="inline-notice" aria-live="polite">
          {draft.includePower ? <><strong>Actuellement : {fmt(stats[draft.statKey!] || 0)} {stat?.name} + {fmt(stats.damagePercent || 0)} Puissance = {fmt(getStatConstraintValue(draft, stats))} pour les dégâts.</strong><br />Cette option ne modifie ni les prérequis des objets, ni la prospection, les soins, le tacle ou la fuite. Les boosts temporaires sont exclus.</>
            : <>Actuellement : {fmt(getStatConstraintValue(draft, stats))} {stat?.name}, puissance exclue.</>}
        </p>
      </>}
      {numeric && (
        <>
          <div className="target-input">
            <button
              className="button"
              aria-label="Diminuer la cible"
              disabled={draft.target <= 0}
              onClick={() =>
                update({
                  target: Math.max(
                    0,
                    draft.target - step,
                  ),
                })
              }
            >
              <Minus size={17} />
            </button>
            <input
              aria-label={
                price ? "Budget en millions de kamas" : criticalChance ? "Chance de critique cible en pourcentage" : "Valeur cible"
              }
              type="number"
              min="0"
              max={maximum / scale}
              step={price ? 0.1 : 1}
              value={draft.target / scale}
              onChange={(event) =>
                update({
                  target: Math.min(maximum, Math.max(0, Number(event.target.value) * scale)),
                })
              }
            />
            <button
              className="button"
              aria-label="Augmenter la cible"
              disabled={draft.target >= maximum}
              onClick={() =>
                update({
                  target: Math.min(maximum, draft.target + step),
                })
              }
            >
              <Plus size={17} />
            </button>
          </div>
          <p className="inline-notice">
            {price
              ? "Millions de kamas · selon les prix renseignés pour ton serveur"
              : criticalChance
                ? `Probabilité de coup critique ${draft.kind === "weapon" ? "de l’arme" : "de ce sort"}, avec les bonus du personnage.`
              : draft.statKey === "damagePercent"
                ? "Points ajoutés aux caractéristiques pour les dégâts uniquement. Aucun bonus de prospection, de soins, de tacle ou de fuite."
                : `${damageCriterion ? "Dégâts infligés à la cible du simulateur" : `Valeur totale du personnage${statUnit(stat) ? `, en ${statUnit(stat)}` : ""}`}`}
          </p>
          <div className="preset-values">
            {short.filter((value) => value * scale <= maximum).map((value) => (
              <button
                key={value}
                className={draft.target === value * scale ? "active" : ""}
                onClick={() => update({ target: value * scale })}
              >
                {fmt(value)}
                {price ? " M" : criticalChance || statUnit(stat) === "%" ? " %" : ""}
              </button>
            ))}
          </div>
        </>
      )}
      {statMaximum !== undefined && (
        <p className="inline-notice">Maximum du personnage : <strong>{fmt(statMaximum)}{statUnit(stat) === "%" ? " %" : ` ${stat?.name || ""}`}</strong>. Les bonus au-delà de ce plafond n’augmentent pas la valeur effective.</p>
      )}
      {criticalChance && (
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
      )}
      {damageCriterion && !criticalChance && (
        <>
          <div className="modal-options">
            <label className="field">
              Type de coup
              <select
                value={draft.mode || "normal"}
                onChange={(event) =>
                  update({ mode: event.target.value as Constraint["mode"] })
                }
              >
                <option value="normal">Normal</option>
                <option value="critical">Critique</option>
              </select>
            </label>
            <label className="field">
              Jet ciblé
              <select
                value={draft.metric || "average"}
                onChange={(event) =>
                  update({ metric: event.target.value as Constraint["metric"] })
                }
              >
                <option value="min">Minimum</option>
                <option value="average">Moyen</option>
                <option value="max">Maximum</option>
              </select>
            </label>
          </div>
          {draft.kind === "spell" && <label className="field">
            Moment du lancer
            <select
              value={draft.turnOffset || 0}
              onChange={(event) =>
                update({ turnOffset: Number(event.target.value) })
              }
            >
              {[0, 1, 2, 3, 4, 5, 6].map((turn) => (
                <option key={turn} value={turn}>
                  {turn
                    ? `Relance à T+${turn}, sans lancer intermédiaire`
                    : "Premier lancer"}
                </option>
              ))}
            </select>
          </label>}
        </>
      )}
      {numeric && (
        <div className="check-field">
          <ShieldCheck size={18} color="#bfd583" />
          <label htmlFor={`strict-target-${draft.id}`}>
            Rendre cette cible obligatoire
            <small>Les résultats doivent respecter cette cible.</small>
          </label>
          <input
            id={`strict-target-${draft.id}`}
            type="checkbox"
            checked={draft.strict}
            onChange={(event) => update({ strict: event.target.checked })}
          />
        </div>
      )}
    </>
  );
}

export function Priorities({
  catalog,
  constraints,
  onChange,
  onEdit,
  saved,
  evaluation,
}: {
  catalog: Catalog;
  constraints: Constraint[];
  onChange: (value: Constraint[]) => void;
  onEdit: (value: Constraint) => void;
  saved: boolean;
  evaluation: BuildEvaluation;
}) {
  const populated = Array.from(
    new Set(constraints.map((entry) => entry.priority)),
  ).sort((a, b) => a - b);
  const [extraLevel, setExtraLevel] = useState(false);
  const levels =
    extraLevel || !populated.length
      ? [...populated, (populated.at(-1) ?? -1) + 1]
      : populated;
  const [over, setOver] = useState<number | null>(null);
  const normalize = (rows: Constraint[]) => {
    const all = Array.from(new Set(rows.map((entry) => entry.priority))).sort(
      (a, b) => a - b,
    );
    return rows.map((entry) => ({
      ...entry,
      priority: all.indexOf(entry.priority),
    }));
  };
  const move = (id: string, target: number) => {
    onChange(
      normalize(
        constraints.map((entry) =>
          entry.id === id ? { ...entry, priority: target } : entry,
        ),
      ),
    );
    setExtraLevel(false);
  };
  function reorder(index: number, direction: number) {
    const from = levels[index],
      to = levels[index + direction];
    if (to === undefined) return;
    onChange(
      normalize(
        constraints.map((entry) => ({
          ...entry,
          priority:
            entry.priority === from
              ? to
              : entry.priority === to
                ? from
                : entry.priority,
        })),
      ),
    );
  }
  return (
    <section className="panel priorities-panel">
      <div className="panel-head">
        <h2>
          <SlidersHorizontal size={17} /> Mes priorités
        </h2>
        <span className="counter">{constraints.length} critères</span>
      </div>
      <p className="priority-help">
        Le plus important en haut. Regroupe les critères pour leur donner la
        même importance.
      </p>
      {levels.map((level, index) => (
        <div className="priority-level" key={level}>
          <div className="priority-level-head">
            <span className="level-number">{index + 1}</span>
            <span>
              {index === 0 ? "EN PREMIER" : index === 1 ? "PUIS" : "ENSUITE"}
            </span>
            <div className="level-actions">
              <button
                className="icon-button"
                disabled={index === 0}
                onClick={() => reorder(index, -1)}
                aria-label={`Monter le niveau ${index + 1}`}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-button"
                disabled={index === levels.length - 1}
                onClick={() => reorder(index, 1)}
                aria-label={`Descendre le niveau ${index + 1}`}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          </div>
          <div
            className={`priority-drop ${over === level ? "drag-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(level);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              move(id, level);
              setOver(null);
            }}
          >
            {constraints
              .filter((entry) => entry.priority === level)
              .map((criterion) => (
                <div
                  className="priority-row"
                  key={criterion.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", criterion.id)
                  }
                  onDragEnd={() => setOver(null)}
                >
                  <GripVertical className="grip" size={15} />
                  <button
                    className="priority-edit"
                    onClick={() => onEdit(criterion)}
                  >
                    <CriterionIcon catalog={catalog} criterion={criterion} weapon={catalog.items.find((item) => item.id === evaluation.build.slots.weapon)} />
                    <span className="priority-copy">
                      <strong>{constraintName(catalog, criterion)}</strong>
                      <small>
                        {constraintTarget(criterion)}
                        {criterion.strict && <b> · Obligatoire</b>}
                      </small>
                      {criterion.metric === "criticalChance" && (
                        <small className="priority-current">
                          Avec ton stuff : {(() => {
                            const result = evaluation.constraints.find((entry) => entry.id === criterion.id);
                            return result?.supported ? `${fmt(result.value)} %` : "À vérifier";
                          })()}
                        </small>
                      )}
                    </span>
                  </button>
                  <select
                    className="priority-select"
                    aria-label={`Déplacer ${constraintName(catalog, criterion)}`}
                    value={level}
                    onChange={(event) =>
                      move(criterion.id, Number(event.target.value))
                    }
                  >
                    {levels.map((number, order) => (
                      <option key={number} value={number}>
                        Priorité {order + 1}
                      </option>
                    ))}
                    <option value={(levels.at(-1) || 0) + 1}>
                      Nouveau niveau
                    </option>
                  </select>
                  <button
                    className="icon-button"
                    onClick={() =>
                      onChange(
                        normalize(
                          constraints.filter(
                            (entry) => entry.id !== criterion.id,
                          ),
                        ),
                      )
                    }
                    aria-label={`Supprimer ${constraintName(catalog, criterion)}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            {!constraints.some((entry) => entry.priority === level) && (
              <div className="empty-drop">Dépose un critère ici</div>
            )}
          </div>
        </div>
      ))}
      <button
        className="new-level"
        onClick={() => setExtraLevel(true)}
        disabled={extraLevel}
      >
        <Plus size={13} /> Ajouter un niveau de priorité
      </button>
      <div className="priority-footer">
        <Check size={12} />{" "}
        {saved
          ? "Enregistré automatiquement dans ce navigateur"
          : "Sauvegarde locale indisponible"}
      </div>
    </section>
  );
}

export function CriteriaCatalog({
  catalog,
  request,
  weapon,
  onAdd,
  onEdit,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  weapon?: EquipmentItem;
  onAdd: (criterion: Constraint) => void;
  onEdit: (criterion: Constraint) => void;
}) {
  const [type, setType] = useState<"stats" | "spells" | "price">("stats");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Essentielles");
  const [allClasses, setAllClasses] = useState(false);
  const [spellLimit, setSpellLimit] = useState(40);
  const categoryOrder = [
    "Essentielles",
    "Dommages",
    "Résistances",
    "Utilitaires",
    "Combat",
    "Autres",
  ];
  const categories = [
    "Tout",
    ...Array.from(new Set(catalog.stats.map((stat) => stat.category))).sort(
      (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b),
    ),
  ];
  const matches = (name: string) =>
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .includes(
        search
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase(),
      );
  const stats = catalog.stats.filter(
    (stat) =>
      (category === "Tout" || category === stat.category) && matches(stat.name),
  );
  const spells = useMemo(
    () =>
      catalog.spells.filter(
        (spell) =>
          hasStatScalingSpellDamage(spell, request.character.level, catalog) &&
          (allClasses ||
            spell.classIds.includes(request.character.classId) ||
            spell.classIds.length === 0) &&
          matches(spell.name),
      ),
    [catalog, request.character.classId, request.character.level, allClasses, search],
  );
  const currentClass = catalog.classes.find(
    (entry) => entry.id === request.character.classId,
  );
  function addStat(stat: StatDefinition) {
    const existing = request.constraints.find(
      (entry) => entry.kind === "stat" && entry.statKey === stat.key,
    );
    if (existing) {
      onEdit(existing);
      return;
    }
    onAdd({
      id: uid(),
      kind: "stat",
      statKey: stat.key,
      target: Math.min(STAT_CAPS[stat.key] ?? Infinity, stat.defaultTarget || (statUnit(stat) === "%" ? 30 : 100)),
      relation: "atLeast",
      priority: 0,
      strict: false,
    });
  }
  function addSpell(spell: Spell) {
    onAdd({
      id: uid(),
      kind: "spell",
      spellId: spell.id,
      target: 1000,
      mode: "critical",
      metric: "min",
      turnOffset: 0,
      relation: "atLeast",
      priority: 0,
      strict: false,
    });
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Ce que je vise</h2>
          <p>Clique sur un critère pour lui donner une cible.</p>
        </div>
        <span className="counter">{catalog.stats.length} caractéristiques</span>
      </div>
      <div className="segment">
        {[
          ["stats", SlidersHorizontal, "Caractéristiques"],
          ["spells", Swords, "Dégâts & critiques"],
          ["price", Coins, "Budget"],
        ].map(([id, Icon, label]) => {
          const Comp = Icon as typeof Swords;
          return (
            <button
              key={String(id)}
              className={type === id ? "active" : ""}
              onClick={() => {
                setType(id as typeof type);
                setSearch("");
              }}
            >
              <Comp size={14} />
              {String(label)}
            </button>
          );
        })}
      </div>
      {type !== "price" && (
        <div className="catalog-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={
              type === "stats"
                ? "Rechercher une caractéristique…"
                : "Rechercher un sort…"
            }
          />
          {type === "spells" && (
            <button
              className={`button small ${allClasses ? "primary" : "ghost"}`}
              onClick={() => setAllClasses((value) => !value)}
            >
              {allClasses
                ? "Toutes les classes"
                : currentClass?.name || "Ma classe"}
            </button>
          )}
        </div>
      )}
      {type === "stats" && (
        <>
          <div
            className="category-tabs"
            aria-label="Catégories de caractéristiques"
          >
            {categories.map((name) => (
              <button
                key={name}
                className={category === name ? "active" : ""}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {categories
            .slice(1)
            .filter((name) => stats.some((stat) => stat.category === name))
            .map((name) => (
              <div className="stat-section" key={name}>
                <div className="section-label">{name}</div>
                <div className="stat-tiles">
                  {stats
                    .filter((stat) => stat.category === name)
                    .map((stat) => {
                      const added = request.constraints.some(
                        (entry) => entry.statKey === stat.key,
                      );
                      return (
                        <button
                          className={`stat-tile ${added ? "added" : ""}`}
                          key={stat.key}
                          onClick={() => addStat(stat)}
                        >
                          <StatIcon stat={stat} />
                          <span>{stat.name}</span>
                          {added ? <Check size={13} /> : <Plus size={13} />}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          {!stats.length && (
            <div className="empty-state">
              <Search size={20} />
              <p>Aucune caractéristique trouvée.</p>
            </div>
          )}
          <div className="stats-footnote">
            <Info size={12} /> Les caractéristiques proviennent du catalogue de
            la version {catalog.version}.
          </div>
        </>
      )}
      {type === "spells" && (
        <>
          <button className="weapon-criterion-card" onClick={() => onAdd({
            id: uid(), kind: "weapon", target: 1000, mode: "critical", metric: "min",
            relation: "atLeast", priority: 0, strict: false,
          })}>
            <span className="weapon-criterion-icon">{weapon?.icon ? <GameImage src={weapon.icon} /> : <Swords size={24} />}</span>
            <span><strong>Dégâts & critiques de l’arme</strong><small>{weapon ? weapon.name : "L’arme de chaque stuff candidat"} · objectifs combinables</small></span>
            <Plus size={17} />
          </button>
          <p className="inline-notice">Seuls les sorts dont les dégâts dépendent de tes caractéristiques sont proposés. Règle leurs dégâts et leur chance de critique, ensemble ou séparément.</p>
          <div className="spell-picker-grid">
            {spells.slice(0, spellLimit).map((spell) => (
              <button
                className="spell-pick"
                key={spell.id}
                onClick={() => addSpell(spell)}
              >
                <GameImage src={spell.icon} />
                <span>{spell.name}</span>
                <small>
                  {getSpellLevel(spell, request.character.level)?.apCost ?? "—"}{" "}
                  PA
                </small>
              </button>
            ))}
          </div>
          {!spells.length && (
            <div className="empty-state">
              Aucun sort de dégâts disponible pour ce niveau et ces filtres. Essaie avec toutes les classes.
            </div>
          )}
          {spells.length > spellLimit && (
            <button
              className="button ghost more-button"
              onClick={() => setSpellLimit((value) => value + 60)}
            >
              Voir plus de sorts <ChevronRight size={14} />
            </button>
          )}
          <p className="pagination-summary">
            {Math.min(spellLimit, spells.length)} sur {spells.length} sorts ·
            variantes incluses
          </p>
        </>
      )}
      {type === "price" && (
        <div style={{ paddingTop: 22 }}>
          <div className="notice">
            <Coins size={18} />
            <div>
              Le prix est une priorité comme les autres. Fixe un plafond, ou
              demande simplement le stuff le moins cher. Les prix sont propres
              au serveur sélectionné.
            </div>
          </div>
          <button
            className="stat-tile"
            style={{ width: "100%", marginTop: 17 }}
            onClick={() => {
              const old = request.constraints.find(
                (entry) => entry.kind === "price",
              );
              if (old) onEdit(old);
              else
                onAdd({
                  id: uid(),
                  kind: "price",
                  target: 20_000_000,
                  relation: "atMost",
                  priority: 0,
                  strict: false,
                });
            }}
          >
            <StatIcon price />
            <span>Budget du stuff</span>
            <Plus size={15} />
          </button>
          <p className="inline-notice">
            Un prix manquant n’est jamais compté comme zéro. Renseigne tes prix
            dans l’onglet Marché.
          </p>
        </div>
      )}
    </section>
  );
}
