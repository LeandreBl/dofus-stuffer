import { Info, LoaderCircle, Shield, Sparkles } from "lucide-react";
import { formatItemCondition, type Catalog, type EquipmentItem, type OptimizationRequest } from "@dofus/shared";
import { GameImage } from "../components/GameImage";
import { StatIcon } from "../components/StatIcon";
import { readableText, weaponEffectText } from "../lib/effect-text";
import { fmt, money, statUnit } from "../lib/format";

/** Read-only contents, separate from the editor and its action controls. */
export function ItemSummary({ item, catalog, request, issues, note }: {
  item: EquipmentItem; catalog: Catalog; request: OptimizationRequest; issues?: string[];
  /** Highlighted line under the heading, e.g. the slot is still being searched. */
  note?: string;
}) {
  const set = catalog.sets.find(set => set.id === item.setId);
  const price = request.prices.values[String(item.id)] ?? request.prices.automaticValues?.[String(item.id)];
  const weaponEffects = item.weapon ? item.effects?.filter(effect => effect.isInFight && effect.visibleInTooltip !== false && effect.description) || [] : [];
  return <>
    <div className="item-hover-heading"><GameImage src={item.icon} /><div>
      <h3>{item.name}</h3><p>Niveau {item.level} · {item.typeName}</p>
      {set && <span className="item-hover-set"><Shield size={12} />{set.name}</span>}
    </div></div>
    {note && <p className="item-hover-note"><LoaderCircle className="spin" size={12} />{note}</p>}
    <div className="item-hover-stats">{Object.entries(item.stats).filter(([, value]) => value !== 0).map(([key, value]) => {
      const stat = catalog.stats.find(stat => stat.key === key);
      return <div className={`stat-line ${value < 0 ? "malus" : ""}`} key={key}>
        <StatIcon stat={stat} /><span>{stat?.name || key}</span><strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
      </div>;
    })}</div>
    {item.weapon && <section><h4>Arme · {item.weapon.apCost} PA · {item.weapon.minRange}–{item.weapon.range} PO</h4>
      <p>{item.weapon.criticalHitProbability} % critique · +{item.weapon.criticalHitBonus} dommages critiques</p>
      {weaponEffects.map((effect, index) => <p key={index}>{weaponEffectText(effect, catalog)}</p>)}
    </section>}
    {(item.conditions || item.conditionsText) && <section className="item-hover-conditions"><h4><Info size={12} />Conditions d’équipement</h4>
      <p>{item.conditions ? formatItemCondition(item.conditions, catalog) : "Condition particulière à vérifier dans la fiche."}</p>
    </section>}
    {!!item.passives?.length && <section><h4><Sparkles size={12} />Effets passifs</h4>
      {item.passives.map(passive => <div className="item-hover-passive" key={passive.id}><strong>{passive.name}</strong>
        {!!passive.description && <p>{readableText(passive.description)}</p>}
      </div>)}
    </section>}
    {!!issues?.length && <section className="item-hover-issues">{issues.map((issue, index) => <p key={index}>{issue}</p>)}</section>}
    {!!item.dataWarnings?.length && <section className="item-hover-issues">{item.dataWarnings.map((warning, index) => <p key={index}>{warning}</p>)}</section>}
    {!!item.unsupportedEffects?.length && <section><h4>Autres effets</h4>{item.unsupportedEffects.map((effect, index) => <p key={index}>{readableText(effect)}</p>)}</section>}
    <footer><span>{request.prices.server}</span><strong>{money(price)}</strong></footer>
  </>;
}
