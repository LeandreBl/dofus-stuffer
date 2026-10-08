import { useMemo } from "react";
import { ChevronRight, Clock3, Crosshair, Info, Plus, Swords } from "lucide-react";
import {
  calculatePreviewWeaponDamage,
  type BuildEvaluation,
  type Catalog,
  type CombatPreviewContext,
  type Constraint,
  type OptimizationRequest,
} from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { StatIcon } from "../../components/StatIcon";
import { ItemHover } from "../../items/ItemHover";
import { fmt, uid } from "../../lib/format";
import { elementKeys, elementNames, rangeLabel } from "./damage";

export function WeaponPreview({ catalog, request, evaluation, context, onAdd, onWeapon }: {
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
        {weapon ? <ItemHover item={weapon} catalog={catalog} request={request}><GameImage src={weapon.icon} /></ItemHover> : <span className="weapon-empty-icon"><Swords size={30} /></span>}
        <div><span className="weapon-eyebrow">Arme équipée</span><h2>{weapon?.name || "Aucune arme équipée"}</h2><small>{weapon ? `${weapon.typeName} · Niveau ${weapon.level}` : "Équipe une arme pour voir ses dégâts avec ton stuff."}</small></div>
      </div>
      <button className="button ghost small" onClick={onWeapon}>{weapon ? "Changer d’arme" : "Choisir une arme"}<ChevronRight size={13} /></button>
    </div>
    {weapon && damage && <>
      <p className="weapon-combat-context"><Crosshair size={12} /> Par coup · {request.target.distance === "melee" ? "En mêlée" : "À distance"} · Résistances communes au grimoire, réglables au-dessus.</p>
      {weapon.weapon && <div className="spell-meta">
        <span><StatIcon stat={catalog.stats.find((stat) => stat.key === "actionPoints")} />{damage.apCost} PA</span>
        <span><Crosshair size={13} />{damage.minRange} – {damage.range} PO</span>
        <span><StatIcon stat={catalog.stats.find((stat) => stat.key === "criticalHit")} />{fmt(damage.critChance)} % critique</span>
        <span><Clock3 size={13} />{damage.maxCastPerTurn || "∞"} / tour</span>
      </div>}
      {!damage.supported && <div className="notice warning weapon-damage-warning"><Info size={16} /><div><strong>Calcul de cette arme à vérifier.</strong>{damage.warnings.length ? damage.warnings.map((warning, index) => <p key={index}>{warning}</p>) : <p>Les données disponibles ne permettent pas de garantir ses dégâts.</p>}</div></div>}
      <div className="damage-columns">
        {(["normal", "critical"] as const).map((mode) => {
          const range = damage[mode];
          return <div className={`damage-block ${mode}`} key={mode}>
            <label>{mode === "critical" ? <StatIcon stat={catalog.stats.find((stat) => stat.key === "criticalHit")} /> : <StatIcon stat={catalog.stats.find((stat) => stat.key === "weaponDamagePercent")} />}{mode === "normal" ? "Coup normal" : "Coup critique"}</label>
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
