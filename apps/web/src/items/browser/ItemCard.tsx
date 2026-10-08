import { CircleSlash, Info, LockKeyhole, Plus, Shield, Swords, UnlockKeyhole } from "lucide-react";
import { formatItemCondition, type Catalog, type EquipmentItem, type OptimizationRequest } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { StatIcon } from "../../components/StatIcon";
import { fmt, statUnit } from "../../lib/format";
import { ItemHover } from "../ItemHover";

export function ItemCard({ item, catalog, request, excluded, locked, statKeys, preview = true, onOpen, onSet, onExclude, onLock, onEquip }: {
  item: EquipmentItem;
  catalog: Catalog;
  request: OptimizationRequest;
  excluded: boolean;
  locked: boolean;
  /** Characteristics highlighted by the active filters. */
  statKeys: string[];
  /** Shows the hover preview card. */
  preview?: boolean;
  onOpen: () => void;
  onSet: (setId: number) => void;
  onExclude: () => void;
  onLock: () => void;
  onEquip: () => void;
}) {
  return (
    <ItemHover item={preview ? item : undefined} catalog={catalog} request={request}><article
      className={`item-card ${excluded ? "excluded" : ""} ${locked ? "locked" : ""}`}
    >
      <button
        className="item-card-head"
        style={{ background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" }}
        onClick={onOpen}
      >
        <GameImage src={item.icon} />
        <div>
          <h3>{item.name}</h3>
          <small>
            Niv. {item.level} · {item.typeName}
          </small>
        </div>
      </button>
      {item.setId && <button className="item-card-set" onClick={() => onSet(item.setId!)}><Shield size={11} />{catalog.sets.find((set) => set.id === item.setId)?.name}</button>}
      {item.weapon && <p className="item-card-weapon"><Swords size={12} /> Arme · {item.weapon.apCost} PA · {item.weapon.minRange}–{item.weapon.range} PO · {item.weapon.criticalHitProbability} % crit.</p>}
      <div className="item-stats">
        {Object.entries(item.stats)
          .filter(([, value]) => value !== 0)
          .map(([key, value]) => {
            const stat = catalog.stats.find((entry) => entry.key === key);
            return (
              <div key={key} className={`stat-line ${value < 0 ? "malus" : ""} ${statKeys.includes(key) ? "highlight" : ""}`}>
                <StatIcon stat={stat} />
                <span title={stat?.name || key}>{stat?.name || key}</span>
                <strong>{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat)}</strong>
              </div>
            );
          })}
      </div>
      {item.conditions && <p className="item-condition-preview"><Info size={12} aria-hidden="true" /><span>{formatItemCondition(item.conditions, catalog)}</span></p>}
      {!item.conditions && item.conditionsText && <p className="item-condition-preview"><Info size={12} aria-hidden="true" /><span>Conditions à vérifier · voir la fiche</span></p>}
      {!!item.dataWarnings?.length && <p className="item-data-note"><Info size={11} /> Données à vérifier · voir la fiche</p>}
      <div className="item-card-actions">
        <button
          className="icon-button"
          aria-label={`${excluded ? "Autoriser" : "Exclure"} ${item.name}`}
          title={excluded ? "Autoriser cet objet" : "Exclure cet objet"}
          onClick={onExclude}
        >
          {excluded ? <Plus size={14} /> : <CircleSlash size={14} />}
        </button>
        <button
          className="icon-button"
          aria-label={`${locked ? "Déverrouiller" : "Verrouiller"} ${item.name}`}
          title={locked ? "Déverrouiller" : "Imposer cet objet"}
          onClick={onLock}
        >
          {locked ? <LockKeyhole size={14} color="#d1e97f" /> : <UnlockKeyhole size={14} />}
        </button>
        <button className="button small" onClick={onEquip}>
          Équiper
        </button>
      </div>
    </article></ItemHover>
  );
}
