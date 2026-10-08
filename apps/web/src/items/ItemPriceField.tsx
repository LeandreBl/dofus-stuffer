import type { EquipmentItem, OptimizationRequest } from "@dofus/shared";
import { fmt } from "../lib/format";
import { priceSourceLabel } from "../lib/prices";

/** Custom price of one item on the selected server, falling back to the automatic price. */
export function ItemPriceField({ item, request, onChange }: {
  item: EquipmentItem;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
}) {
  const priceKey = String(item.id);
  const selectedPrices = request.prices.values;
  const automatic = request.prices.automaticValues?.[priceKey];
  const changeValues = (values: Record<string, number>) =>
    onChange({ ...request, prices: { ...request.prices, values, updatedAt: new Date().toISOString() } });
  return (
    <>
      <label className="field">
        Prix de l’objet sur {request.prices.server} (kamas)
        <input
          type="number"
          min="0"
          value={selectedPrices[priceKey] ?? automatic ?? ""}
          placeholder="Prix inconnu"
          onChange={(event) => {
            const values = { ...selectedPrices };
            if (event.target.value === "") delete values[priceKey];
            else values[priceKey] = Math.max(0, Number(event.target.value));
            changeValues(values);
          }}
        />
      </label>
      <p className="inline-notice">{priceSourceLabel(selectedPrices[priceKey], automatic)} · Effacer ton prix reprend le prix automatique disponible.</p>
      {selectedPrices[priceKey] !== undefined && automatic !== undefined && <button className="button small ghost" onClick={() => {
        const values = { ...selectedPrices };
        delete values[priceKey];
        changeValues(values);
      }}>Reprendre le prix automatique · {fmt(automatic)} K</button>}
    </>
  );
}
