import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Crosshair,
  Info,
  Plus,
  Settings2,
  Sparkles,
  Swords,
} from "lucide-react";
import {
  calculatePreviewSpellDamage,
  calculatePreviewWeaponDamage,
  createCombatPreviewContext,
  getSpellLevel,
  type BuildEvaluation,
  type Catalog,
  type CombatTarget,
  type CombatPreviewContext,
  type Constraint,
  type DamageRange,
  type Element,
  type OptimizationRequest,
  type Spell,
  type SpellDamage,
  type SpellScenario,
} from "@dofus/shared";
import { fmt, GameImage, plainText, SearchField, StatIcon, uid } from "./ui";
import { getSpellDamageElements } from "./spellElements";
import { CombatPreviewPanel, loadCombatPreview, saveCombatPreview } from "./CombatPreview";
import { SpellScenarioPanel } from "./SpellScenario";
import { withoutCreatureTarget } from "./spell-scenario";

const elementKeys: Record<Element, string> = {
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
  neutral: "neutralDamageBonus",
};
const elementNames: Record<Element, string> = {
  earth: "Terre",
  fire: "Feu",
  water: "Eau",
  air: "Air",
  neutral: "Neutre",
};
const filterElements: Element[] = ["earth", "fire", "water", "air", "neutral"];
const rangeLabel = (range: DamageRange | null | undefined) =>
  range ? `${fmt(range.min)} – ${fmt(range.max)}` : "—";

function WeaponPreview({ catalog, request, evaluation, context, onAdd, onWeapon }: {
  catalog: Catalog;
  request: OptimizationRequest;
  evaluation: BuildEvaluation;
  context: CombatPreviewContext;
  onAdd: (constraint: Constraint) => void;
  onWeapon: () => void;
}) {
  const weapon = catalog.items.find((item) => item.id === evaluation.build.slots.weapon);
  const damage = useMemo(() => weapon ? calculatePreviewWeaponDamage(weapon, request.character, request.target, context) : undefined,
    [weapon, context, request.target, request.character]);
  const defineObjectives = () => onAdd({ id: uid(), kind: "weapon", metric: "min", mode: "critical", target: 1000, relation: "atLeast", priority: 0, strict: false });
  return <section className="panel weapon-damage-panel" aria-label="Dégâts de l’arme équipée">
    <div className="weapon-damage-header">
      <div className="spell-detail-heading">
        {weapon ? <GameImage src={weapon.icon} /> : <span className="weapon-empty-icon"><Swords size={30} /></span>}
        <div><span className="weapon-eyebrow">Arme équipée</span><h2>{weapon?.name || "Aucune arme équipée"}</h2><small>{weapon ? `${weapon.typeName} · Niveau ${weapon.level}` : "Équipe une arme pour voir ses dégâts avec ton stuff."}</small></div>
      </div>
      <button className="button ghost small" onClick={onWeapon}>{weapon ? "Changer d’arme" : "Choisir une arme"}<ChevronRight size={13} /></button>
    </div>
    {weapon && damage && <>
      <p className="weapon-combat-context"><Crosshair size={12} /> Par coup · {request.target.distance === "melee" ? "En mêlée" : "À distance"} · Résistances communes au grimoire, réglables au-dessus.</p>
      {weapon.weapon && <div className="spell-meta">
        <span><StatIcon stat={catalog.stats.find((stat) => stat.key === "actionPoints")} />{damage.apCost} PA</span>
        <span><Crosshair size={13} />{damage.minRange} – {damage.range} PO</span>
        <span><Sparkles size={13} />{fmt(damage.critChance)} % critique</span>
        <span><Clock3 size={13} />{damage.maxCastPerTurn || "∞"} / tour</span>
      </div>}
      {!damage.supported && <div className="notice warning weapon-damage-warning"><Info size={16} /><div><strong>Calcul de cette arme à vérifier.</strong>{damage.warnings.length ? damage.warnings.map((warning, index) => <p key={index}>{warning}</p>) : <p>Les données disponibles ne permettent pas de garantir ses dégâts.</p>}</div></div>}
      <div className="damage-columns">
        {(["normal", "critical"] as const).map((mode) => {
          const range = damage[mode];
          return <div className={`damage-block ${mode}`} key={mode}>
            <label>{mode === "critical" ? <Sparkles size={13} /> : <Swords size={13} />}{mode === "normal" ? "Coup normal" : "Coup critique"}</label>
            <strong>{damage.supported ? rangeLabel(range) : "À vérifier"}</strong>
            <small>{damage.supported && range ? `Moyenne ${fmt(range.average)} · ${fmt(damage.apCost ? range.average / damage.apCost : 0)} / PA` : mode === "critical" && !range ? "Cette arme ne possède pas de coup critique." : "Mécanique non prise en charge"}</small>
            {damage.supported && damage.lines.length > 0 && <div className="damage-lines">{damage.lines.map((line, index) => <span key={index}><StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[line.element])} />{rangeLabel(line[mode])} {elementNames[line.element]}</span>)}</div>}
          </div>;
        })}
      </div>
      {damage.supported && <p className="weapon-damage-average">Moyenne avec critiques : <strong>{fmt(damage.expected)}</strong> · <strong>{fmt(damage.perAp)}</strong> dégâts / PA</p>}
      {damage.supported && damage.warnings.length > 0 && <p className="inline-notice">{damage.warnings.join(" · ")}</p>}
    </>}
    <div className="weapon-objective-footer">
      <p>La recherche compare l’arme de chaque stuff. Verrouille une arme dans Mon stuff pour la conserver.</p>
      <button className="button primary" onClick={defineObjectives}><Plus size={15} /> Définir mes objectifs d’arme</button>
    </div>
  </section>;
}

export function SpellView({
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
  const [scenarios, setScenarios] = useState<Record<string,SpellScenario>>(() => {
    try { return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('dofus-spell-scenarios-v1') || '{}') as Record<string,SpellScenario>).map(([key,scenario])=>[key,withoutCreatureTarget(scenario)])); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('dofus-spell-scenarios-v1',JSON.stringify(scenarios)); }, [scenarios]);
  useEffect(() => saveCombatPreview(combatState), [combatState]);
  const combatContext = useMemo(() => createCombatPreviewContext(catalog, evaluation.build, request.character, evaluation.stats, combatState),
    [catalog, evaluation.build, request.character, evaluation.stats, combatState]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState(
    String(request.character.classId),
  );
  const [elementFilter, setElementFilter] = useState<Element[]>([]);
  const spellElements = useMemo(
    () => new Map(catalog.spells.map((spell) => [spell.id, getSpellDamageElements(spell, request.character.level, catalog)])),
    [catalog.spells, request.character.level],
  );
  const [selectedId, setSelectedId] = useState(
    initialSpellId ||
      catalog.spells.find(
        (spell) =>
          spell.classIds.includes(request.character.classId) &&
          /punitive/i.test(spell.name),
      )?.id ||
      catalog.spells.find((spell) =>
        spell.classIds.includes(request.character.classId),
      )?.id ||
      catalog.spells[0]?.id,
  );
  const [limit, setLimit] = useState(70);
  const spells = useMemo(
    () =>
      catalog.spells.filter(
        (spell) =>
          (classFilter === "all" ||
            spell.classIds.includes(Number(classFilter)) ||
            spell.classIds.length === 0) &&
          (!elementFilter.length || spellElements.get(spell.id)?.some((element) => elementFilter.includes(element))) &&
          spell.name
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .includes(
              search
                .normalize("NFD")
                .replace(/\p{Diacritic}/gu, "")
                .toLowerCase(),
            ),
      ),
    [catalog, classFilter, search, elementFilter, spellElements],
  );
  const selected =
    spells.find((spell) => spell.id === selectedId) || spells[0];
  const damageMap = useMemo(
    () =>
      new Map(
        spells
          .slice(0, limit)
          .map((spell) => [
            spell.id,
            calculatePreviewSpellDamage(
              spell,
              request.character,
              request.target,
              combatContext,
              scenarios[spell.id],
            ),
          ]),
      ),
    [spells, limit, combatContext, request.target, request.character, scenarios],
  );
  const damage = useMemo(
    () =>
      selected
        ? calculatePreviewSpellDamage(
            selected,
            request.character,
            request.target,
            combatContext,
            scenarios[selected.id],
          )
        : undefined,
    [selected, combatContext, request.target, request.character, scenarios],
  );
  const level = selected && getSpellLevel(selected, request.character.level);
  const changeTarget = (changes: Partial<CombatTarget>) =>
    onChange({ ...request, target: { ...request.target, ...changes } });
  const elements: Element[] = ["neutral", "earth", "fire", "water", "air"];
  const add = (metric: Constraint["metric"] = "min") => {
    if (selected)
      onAdd({
        id: uid(),
        kind: "spell",
        spellId: selected.id,
        target: metric === "criticalChance" ? 75 : 1000,
        relation: "atLeast",
        priority: 0,
        strict: false,
        mode: metric === "criticalChance" ? undefined : damage?.critical ? "critical" : "normal",
        metric,
        turnOffset: metric === "criticalChance" ? undefined : 0,
        scenario: metric === "criticalChance" ? undefined : scenarios[selected.id],
      });
  };
  const both = (spell: Spell, data?: SpellDamage) => (
    <>
      {data?.supported ? (
        <>
          <span>{rangeLabel(data.normal)}</span>
          <small>
            {data.critical
              ? `${rangeLabel(data.critical)} crit.`
              : data.damageKind === 'summon' ? "Invocation · choisir l’attaque" : data.normal.max===0&&spellElements.get(spell.id)?.length&&(data.scenarioOptions?.length||data.castSources?.length||data.parameters?.includes('runes')) ? "Choisir la situation" : data.damageKind === 'support' ? "Sort de soutien" : "Sans critique"}
          </small>
        </>
      ) : (
        <>
          <span>Effets à vérifier</span>
          <small>Calcul partiel</small>
        </>
      )}
    </>
  );
  return (
    <>
      <div className="notice page-notice">
        <Info size={16} />
        <div>
          Calcul instantané avec ton équipement actuel et les résistances de la
          cible.{" "}
          <strong>
            {Object.keys(evaluation.build.slots).length} objets équipés
          </strong>
          . Configure les états et déclenchements dans la fiche de chaque sort.
        </div>
      </div>
      {evaluation.warnings.length > 0 && (
        <div className="notice warning page-notice">
          <Info size={17} />
          <div>
            <strong>Vérifications du stuff hors combat.</strong> Les passifs
            cochés ci-dessous sont compris dans l’aperçu. Les autres effets non
            pris en charge restent signalés.
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>
                Voir les {evaluation.warnings.length} informations
              </summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {evaluation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}
      {evaluation.violations.length > 0 && Object.keys(evaluation.build.slots).length > 0 && (
        <div className="notice warning page-notice">
          <Info size={17} />
          <div>
            Ce stuff présente des conditions non remplies ou des objectifs
            obligatoires non atteints. Consulte les vérifications dans « Mon stuff ».
          </div>
        </div>
      )}
      <section className="panel damage-target-panel">
        <details className="target-settings">
          <summary>
            <Settings2 size={14} /> Cible & situation de combat{" "}
            <ChevronRight size={13} />
          </summary>
          <p className="target-heading">Résistances élémentaires (%)</p>
          <div className="target-fields">
            {elements.map((element) => (
              <label key={element}>
                <StatIcon
                  stat={catalog.stats.find(
                    (stat) => stat.key === elementKeys[element],
                  )}
                />
                {elementNames[element]}
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={request.target.percent[element] || 0}
                  onChange={(event) =>
                    changeTarget({
                      percent: {
                        ...request.target.percent,
                        [element]: Math.max(
                          -100,
                          Math.min(100, Number(event.target.value)),
                        ),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="target-heading">Résistances fixes</p>
          <div className="target-fields">
            {elements.map((element) => (
              <label key={element}>
                {elementNames[element]}
                <input
                  type="number"
                  min="0"
                  value={request.target.flat[element] || 0}
                  onChange={(event) =>
                    changeTarget({
                      flat: {
                        ...request.target.flat,
                        [element]: Math.max(0, Number(event.target.value)),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="modal-options">
            <label className="field">
              Résistance critique
              <input
                type="number"
                min="0"
                value={request.target.criticalResistance}
                onChange={(event) =>
                  changeTarget({
                    criticalResistance: Math.max(
                      0,
                      Number(event.target.value),
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              Distance
              <select
                value={request.target.distance}
                onChange={(event) =>
                  changeTarget({
                    distance: event.target
                      .value as CombatTarget["distance"],
                  })
                }
              >
                <option value="ranged">À distance</option>
                <option value="melee">En mêlée</option>
              </select>
            </label>
          </div>
        </details>
      </section>
      <CombatPreviewPanel catalog={catalog} build={evaluation.build} character={request.character} state={combatState} context={combatContext} onChange={setCombatState} />
      <WeaponPreview catalog={catalog} request={request} evaluation={evaluation} context={combatContext} onAdd={onAdd} onWeapon={onWeapon} />
      <div className="spell-page-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Grimoire des sorts</h2>
              <p>Normal et critique, côte à côte.</p>
            </div>
            <span className="counter">{spells.length} sorts</span>
          </div>
          <div className="catalog-toolbar">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setLimit(70);
              }}
              placeholder="Trouver un sort…"
            />
            <select
              value={classFilter}
              aria-label="Classe des sorts"
              onChange={(event) => {
                setClassFilter(event.target.value);
                setLimit(70);
              }}
            >
              <option value="all">Toutes les classes</option>
              {catalog.classes.map((gameClass) => (
                <option key={gameClass.id} value={gameClass.id}>
                  {gameClass.name}
                </option>
              ))}
            </select>
          </div>
          <div className="spell-element-filters" role="group" aria-label="Filtrer par élément de dégâts">
            <button
              className={`spell-element-chip ${!elementFilter.length ? "active" : ""}`}
              aria-pressed={!elementFilter.length}
              onClick={() => { setElementFilter([]); setLimit(70); }}
            >
              Tous
            </button>
            {filterElements.map((element) => (
              <button
                key={element}
                className={`spell-element-chip ${elementFilter.includes(element) ? "active" : ""}`}
                aria-pressed={elementFilter.includes(element)}
                aria-label={`Dégâts ${elementNames[element]}`}
                onClick={() => {
                  setElementFilter((current) => current.includes(element)
                    ? current.filter((entry) => entry !== element) : [...current, element]);
                  setLimit(70);
                }}
              >
                <StatIcon stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />
                {elementNames[element]}
              </button>
            ))}
          </div>
          <p className="spell-filter-hint">
            {elementFilter.length
              ? `Dégâts ${elementFilter.map((element) => elementNames[element]).join(" ou ")} · sorts multiéléments inclus.`
              : "Clique sur un ou plusieurs éléments pour filtrer les sorts."}
          </p>
          <div className="spell-list">
            {spells.slice(0, limit).map((spell) => (
              <button
                key={spell.id}
                className={`spell-list-row ${spell.id === selected?.id ? "active" : ""}`}
                onClick={() => setSelectedId(spell.id)}
              >
                <GameImage src={spell.icon} />
                <span className="spell-list-name">
                  <strong>{spell.name}</strong>
                  <small>
                    {getSpellLevel(spell, request.character.level)?.apCost ??
                      "—"}{" "}
                    PA · niv.{" "}
                    {getSpellLevel(spell, request.character.level)
                      ?.minPlayerLevel ?? "—"}
                  </small>
                  {!!spellElements.get(spell.id)?.length && (
                    <span className="spell-row-elements" role="img"
                      aria-label={`Dégâts ${spellElements.get(spell.id)!.map((element) => elementNames[element]).join(", ")}`}
                      title={spellElements.get(spell.id)!.map((element) => elementNames[element]).join(" · ")}>
                      {spellElements.get(spell.id)!.map((element) => (
                        <StatIcon key={element} stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />
                      ))}
                    </span>
                  )}
                </span>
                <span className="spell-list-damage">
                  {both(spell, damageMap.get(spell.id))}
                </span>
                <ChevronRight size={12} />
              </button>
            ))}
            {!spells.length && (
              <div className="empty-state">
                <p>Aucun sort ne correspond à ces filtres.</p>
                <button className="button ghost" onClick={() => {
                  setSearch(""); setClassFilter("all"); setElementFilter([]); setLimit(70);
                }}>Réinitialiser les filtres</button>
              </div>
            )}
          </div>
          {spells.length > limit && (
            <button
              className="button ghost more-button"
              onClick={() => setLimit((value) => value + 100)}
            >
              Afficher plus de sorts
            </button>
          )}
          <p className="pagination-summary">
            {Math.min(limit, spells.length)} / {spells.length} sorts · variantes
            incluses
          </p>
        </section>
        {selected && damage && level ? (
          <section className="panel spell-detail">
            <div className="spell-detail-heading">
              <GameImage src={selected.icon} />
              <div>
                <h2>{selected.name}</h2>
                <small>
                  {selected.classIds
                    .map(
                      (id) =>
                        catalog.classes.find((gameClass) => gameClass.id === id)
                          ?.name,
                    )
                    .filter(Boolean)
                    .join(" · ") || "Sort commun"}{" "}
                  · Rang {level.grade} · Niveau {level.minPlayerLevel}
                </small>
              </div>
            </div>
            <div className="spell-meta">
              <span>
                <StatIcon
                  stat={catalog.stats.find(
                    (stat) => stat.key === "actionPoints",
                  )}
                />
                {level.apCost} PA
              </span>
              <span>
                <Crosshair size={13} />
                {level.minRange} – {level.range} PO
                {level.rangeCanBeBoosted ? " modifiable" : ""}
              </span>
              <span>
                <Sparkles size={13} />
                {fmt(damage.critChance)} % critique
              </span>
              <span>
                <Clock3 size={13} />
                {level.minCastInterval
                  ? `Relance ${level.minCastInterval} tours`
                  : `${level.maxCastPerTurn || "∞"} / tour`}
              </span>
            </div>
            <p className="spell-description">
              {plainText(selected.description)}
            </p>
            <SpellScenarioPanel spell={selected} damage={damage} value={scenarios[selected.id] ?? {}} onChange={value=>setScenarios(current=>({...current,[selected.id]:value}))}/>
            {scenarios[selected.id]?.summonSpellId&&<p className="inline-notice">Attaque prévisualisée : <strong>{damage.summonAttacks?.find(attack=>attack.id===scenarios[selected.id].summonSpellId)?.name}</strong> · {damage.apCost} PA · {fmt(damage.critChance)} % critique.</p>}
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
            <div className="damage-columns">
              {(["normal", "critical"] as const).map((mode) => {
                const range = damage[mode];
                return (
                  <div className={`damage-block ${mode}`} key={mode}>
                    <label>
                      {mode === "critical" ? (
                        <Sparkles size={13} />
                      ) : (
                        <Swords size={13} />
                      )}
                      {mode === "normal" ? "Coup normal" : "Coup critique"}
                    </label>
                    <strong>
                      {damage.supported ? rangeLabel(range) : "À vérifier"}
                    </strong>
                    <small>
                      {damage.supported && range
                        ? `Moyenne ${fmt(range.average)} · ${fmt(damage.apCost ? range.average / damage.apCost : 0)} / PA`
                        : mode === "critical" && !range
                          ? "Ce sort ne possède pas de coup critique."
                          : "Mécanique non prise en charge"}
                    </small>
                    {damage.supported && damage.lines.length > 0 && (
                      <div className="damage-lines">
                        {damage.lines.map((line, index) => (
                          <span key={index}>
                            <StatIcon
                              stat={catalog.stats.find(
                                (stat) =>
                                  stat.key === elementKeys[line.element],
                              )}
                            />
                            {rangeLabel(line[mode])}{" "}
                            {line.kind === 'push' ? 'Poussée' : elementNames[line.element]}
                            {line.delay > 0 ? ` (T+${line.delay})` : ""}
                            {line.trigger ? ` · ${line.trigger === 'TB' ? 'début de tour' : line.trigger === 'TE' ? 'fin de tour' : line.trigger === 'PIÈGE' ? 'piège' : line.trigger === 'GLYPHE' ? 'glyphe' : 'déclenchement'}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {damage.supported && (
              <div className="recast">
                <h3>
                  <Clock3 size={15} /> Dégâts par tour de relance
                </h3>
                <table className="recast-table">
                  <thead>
                    <tr>
                      <th>Lancer</th>
                      <th>Normal</th>
                      <th>Critique</th>
                      <th>Chance CC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damage.turns.map((turn, index) => (
                      <tr key={`${turn.turn}-${index}`}>
                        <td>
                          {turn.turn === 0
                            ? "Premier lancer"
                            : `Relance à T+${turn.turn}`}
                          {!turn.available && <small> · indisponible</small>}
                          <small> · tour {combatState.turn + turn.turn}</small>
                        </td>
                        <td>
                          {turn.available ? rangeLabel(turn.normal) : "—"}
                        </td>
                        <td>
                          {turn.available ? rangeLabel(turn.critical) : "—"}
                        </td>
                        <td>{turn.available ? `${fmt(turn.critChance)} %` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="inline-notice">
                  Chaque ligne suppose un premier lancer à T, puis une relance
                  au tour indiqué, sans lancer intermédiaire. Ce tableau ne
                  simule pas une rotation complète. Les bonus activés expirent
                  selon leur durée et le Nébuleux suit les tours pairs et impairs.
                </p>
              </div>
            )}

            <div className="spell-priority-actions">
              <button className="button primary" onClick={() => add()}>
                <Plus size={15} /> Définir mes objectifs de sort
              </button>
            </div>
            <p className="inline-notice">Dégâts et chance de critique : vise une cible ou maximise les deux.</p>
            {damage.supported && damage.warnings.length > 0 && (
              <p className="inline-notice">{damage.warnings.join(" · ")}</p>
            )}
            <details className="target-settings">
              <summary>
                <Info size={14} /> Effets issus du jeu
              </summary>
              <p className="inline-notice">
                {level.effects
                  .map((effect) =>
                    plainText(effect.description || `Effet ${effect.effectId}`),
                  )
                  .join(" · ") || "Aucun effet direct."}
              </p>
            </details>
          </section>
        ) : (
          <div className="empty-state">
            <Swords size={24} />
            <p>{spells.length ? "Sélectionne un sort disponible à ton niveau." : "Aucun sort à afficher avec ces filtres."}</p>
          </div>
        )}
      </div>
    </>
  );
}
