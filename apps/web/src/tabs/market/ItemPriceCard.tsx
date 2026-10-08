import type { EquipmentItem } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { fmt } from "../../lib/format";
import { priceSourceLabel } from "../../lib/prices";

export function ItemPriceCard({ item, custom, automatic, onChange }: {
  item: EquipmentItem;
  custom?: number;
  automatic?: number;
  /** undefined clears the custom price. */
  onChange: (price?: number) => void;
}) {
  return (
    <article className="item-card">
      <div className="item-card-head">
        <GameImage src={item.icon} />
        <div>
          <h3>{item.name}</h3>
          <small>
            Niv. {item.level} · ID {item.id}
          </small>
        </div>
      </div>
      <div className="item-price">
        <input
          type="number"
          aria-label={`Prix de ${item.name}`}
          min="0"
          placeholder="Prix inconnu"
          value={custom ?? automatic ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)))}
        />
        <span>kamas</span>
      </div>
      <p className="inline-notice">{priceSourceLabel(custom, automatic)}</p>
      {custom !== undefined && automatic !== undefined && <button className="button small ghost" onClick={() => onChange()}>Reprendre le prix automatique · {fmt(automatic)} K</button>}
    </article>
  );
}
