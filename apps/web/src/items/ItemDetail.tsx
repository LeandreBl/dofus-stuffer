import { CircleSlash, Info, Plus, Shield } from "lucide-react";
import type { Build, Catalog, EquipmentItem, OptimizationRequest, Slot } from "@dofus/shared";
import { GameImage } from "../components/GameImage";
import { Modal } from "../components/Modal";
import { StatIcon } from "../components/StatIcon";
import { fmt } from "../lib/format";
import { ItemConditions } from "./ItemConditions";
import { ItemPriceField } from "./ItemPriceField";
import { SetBonuses } from "./SetBonuses";
import { chooseSlot } from "./slots";

export function ItemDetail({
  item,
  catalog,
  request,
  onChange,
  onEquip,
  onClose,
  onRemove,
  onReplace,
  build,
  slot,
  onSet,
}: {
  item: EquipmentItem;
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem) => void;
  onClose: () => void;
  onSet?: (setId: number) => void;
  onRemove?: () => void;
  onReplace?: () => void;
  build: Build;
  slot?: Slot;
}) {
  const equippedSlot = slot ? build.slots[slot] === item.id ? slot : undefined : (Object.keys(build.slots) as Slot[]).find((key) => build.slots[key] === item.id);
  const excludedFromSearch = request.filters.excludedItemIds.includes(item.id);
  const set = catalog.sets.find((entry) => entry.id === item.setId);
  return (
    <Modal title="Détail de l’objet" onClose={onClose}>
      <div className="item-detail-heading">
        <GameImage src={item.icon} />
        <div>
          <h3>{item.name}</h3>
          <p>
            Niveau {item.level} · {item.typeName}
          </p>
          {set && <button className="item-card-set" onClick={() => onSet?.(set.id)}><Shield size={11} />{set.name}</button>}
        </div>
      </div>
      <div className="item-detail-stats">
        {Object.entries(item.stats).map(([key, value]) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          return (
            <div className="stat-line" key={key}>
              <StatIcon stat={stat} />
              <span>{stat?.name || key}</span>
              <strong>{fmt(value)}</strong>
            </div>
          );
        })}
      </div>
      {!!set?.bonuses.length && <section className="item-compatibility">
        <h4>Bonus de la {set.name}</h4>
        <SetBonuses key={set.id} set={set} catalog={catalog} active={set.itemIds.filter((id) => Object.values(build.slots).includes(id)).length} />
      </section>}
      <ItemConditions item={item} catalog={catalog} request={request} build={build} previewSlot={slot || equippedSlot || chooseSlot(item, build)} equipped={!!equippedSlot} />
      {!!item.unsupportedEffects?.length && (
        <div className="notice warning">
          <Info size={15} />
          <div>Effets non simulés : {item.unsupportedEffects.join(" · ")}</div>
        </div>
      )}
      {!!item.dataWarnings?.length && <div className="notice warning"><Info size={15} /><div>{item.dataWarnings.join(" ")}</div></div>}
      <ItemPriceField item={item} request={request} onChange={onChange} />
      {excludedFromSearch && <p className="inline-notice" role="status">Cet objet est exclu des prochaines recherches du moteur.</p>}
      <div className="modal-actions item-detail-actions">
        <button
          type="button"
          className="button ghost"
          onClick={() => onChange({
            ...request,
            filters: {
              ...request.filters,
              excludedItemIds: excludedFromSearch
                ? request.filters.excludedItemIds.filter((id) => id !== item.id)
                : [...request.filters.excludedItemIds, item.id],
              lockedSlots: excludedFromSearch ? request.filters.lockedSlots : Object.fromEntries(
                Object.entries(request.filters.lockedSlots).filter(([, id]) => id !== item.id),
              ),
            },
          })}
        >
          {excludedFromSearch ? <Plus size={14} /> : <CircleSlash size={14} />}
          {excludedFromSearch ? "Retirer l’exclusion" : "Exclure du moteur"}
        </button>
        {onRemove && (
          <button className="button ghost danger" onClick={onRemove}>
            Retirer
          </button>
        )}
        {onReplace && (
          <button className="button ghost" onClick={onReplace}>
            Remplacer
          </button>
        )}
        <button
          className="button primary"
          onClick={() => {
            onEquip(item);
            onClose();
          }}
        >
          {onRemove ? "Rééquiper" : "Équiper cet objet"}
        </button>
      </div>
    </Modal>
  );
}
