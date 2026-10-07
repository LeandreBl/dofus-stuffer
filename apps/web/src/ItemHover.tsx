import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Info, Shield, Sparkles } from "lucide-react";
import { formatItemCondition, type Catalog, type EquipmentItem, type OptimizationRequest, type RawEffect } from "@dofus/shared";
import { fmt, GameImage, money, plainText, StatIcon, statUnit } from "./ui";

const readableText = (text: string) => plainText(text.replace(/\{\{(?:spell|item),[^:]+::([^}]+)\}\}/g, "$1")).trim();
function weaponEffectText(effect: RawEffect) {
  const low = effect.diceNum || effect.value, high = effect.diceSide || low;
  return readableText((effect.description || "")
    .replace(/\{\{~1~2 à \}\}#2/g, high !== low ? ` à ${fmt(high)}` : "")
    .replace(/\{\{~[^}]*\}\}/g, "")
    .replace(/#1/g, fmt(low)).replace(/#2/g, fmt(high)).replace(/#3/g, fmt(effect.value)));
}

/** Read-only contents, separate from the editor and its action controls. */
function ItemSummary({ item, catalog, request, issues }: {
  item: EquipmentItem; catalog: Catalog; request: OptimizationRequest; issues?: string[];
}) {
  const set = catalog.sets.find(set => set.id === item.setId);
  const price = request.prices.values[String(item.id)] ?? request.prices.automaticValues?.[String(item.id)];
  const weaponEffects = item.weapon ? item.effects?.filter(effect => effect.isInFight && effect.visibleInTooltip !== false && effect.description) || [] : [];
  return <>
    <div className="item-hover-heading"><GameImage src={item.icon} /><div>
      <h3>{item.name}</h3><p>Niveau {item.level} · {item.typeName}</p>
      {set && <span className="item-hover-set"><Shield size={12} />{set.name}</span>}
    </div></div>
    <div className="item-hover-stats">{Object.entries(item.stats).filter(([, value]) => value !== 0).map(([key, value]) => {
      const stat = catalog.stats.find(stat => stat.key === key);
      return <div className={`stat-line ${value < 0 ? "malus" : ""}`} key={key}>
        <StatIcon stat={stat} /><span>{stat?.name || key}</span><strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
      </div>;
    })}</div>
    {item.weapon && <section><h4>Arme · {item.weapon.apCost} PA · {item.weapon.minRange}–{item.weapon.range} PO</h4>
      <p>{item.weapon.criticalHitProbability} % critique · +{item.weapon.criticalHitBonus} dommages critiques</p>
      {weaponEffects.map((effect, index) => <p key={index}>{weaponEffectText(effect)}</p>)}
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

export function ItemHover({ item, catalog, request, issues, children }: {
  item?: EquipmentItem; catalog: Catalog; request: OptimizationRequest; issues?: string[];
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const cancelLeave = () => { clearTimeout(leaveTimer.current); };
  const hide = () => { cancelLeave(); setOpen(false); setPosition(null); };
  const show = (element: HTMLElement) => {
    if (!item) return;
    if (!open) document.dispatchEvent(new Event("item-preview-open"));
    cancelLeave(); anchor.current = element; setOpen(true);
  };
  const scheduleHide = () => { cancelLeave(); leaveTimer.current = setTimeout(hide, 130); };
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return;
    const box = anchor.current.getBoundingClientRect(), popup = card.current.getBoundingClientRect();
    const gap = 10, margin = 12, width = document.documentElement.clientWidth, height = window.innerHeight;
    let left = box.right + gap, top = box.top;
    if (left + popup.width > width - margin) left = box.left - popup.width - gap;
    if (left < margin) {
      left = Math.max(margin, Math.min(box.left, width - popup.width - margin));
      top = box.bottom + gap;
      if (top + popup.height > height - margin) top = box.top - popup.height - gap;
    }
    setPosition({ left: Math.max(margin, Math.min(left, width - popup.width - margin)), top: Math.max(margin, Math.min(top, height - popup.height - margin)) });
  }, [open, item]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopImmediatePropagation(); event.preventDefault(); hide(); }
    };
    const closeOnScroll = (event: Event) => { if (!(event.target instanceof Node) || !card.current?.contains(event.target)) hide(); };
    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("item-preview-open", hide);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => { document.removeEventListener("keydown", closeOnEscape, true); document.removeEventListener("item-preview-open", hide); window.removeEventListener("resize", hide); window.removeEventListener("scroll", closeOnScroll, true); };
  }, [open]);
  const trigger = cloneElement(children, {
    "aria-describedby": open ? [children.props["aria-describedby"], id].filter(Boolean).join(" ") : children.props["aria-describedby"],
    onPointerEnter: event => { children.props.onPointerEnter?.(event); if (event.pointerType !== "touch") show(event.currentTarget); },
    onPointerLeave: event => { children.props.onPointerLeave?.(event); scheduleHide(); },
    onFocus: event => { children.props.onFocus?.(event); if (event.target.matches(":focus-visible")) show(event.currentTarget); },
    onBlur: event => { children.props.onBlur?.(event); if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) hide(); },
    onClick: event => {
      if (event.target instanceof Element && event.target.closest("button,a,input,select")) hide();
      children.props.onClick?.(event);
    },
  });
  return <>{trigger}{open && item && createPortal(<div ref={card} id={id} role="tooltip" aria-label={`Aperçu de ${item.name}`}
    className="item-hover-card" style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
    onPointerEnter={cancelLeave} onPointerLeave={scheduleHide}>
    <ItemSummary item={item} catalog={catalog} request={request} issues={issues} />
  </div>, document.body)}</>;
}
