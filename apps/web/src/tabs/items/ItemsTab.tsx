import type { Build, Catalog, EquipmentItem, OptimizationRequest, Slot } from "@dofus/shared";
import { ItemBrowser } from "../../items/browser/ItemBrowser";

export function ItemsTab({ setLink, catalog, request, build, onChange, onEquip, onItem }: {
  /** Set opened from an item's "Panoplie …" link; a new key remounts the catalog on it. */
  setLink?: { id: number; key: number };
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem, slot?: Slot) => void;
  onItem: (item: EquipmentItem) => void;
}) {
  return (
    <section className="panel items-panel">
      <ItemBrowser
        key={setLink?.key}
        initialSetId={setLink?.id}
        catalog={catalog}
        request={request}
        build={build}
        onChange={onChange}
        onEquip={onEquip}
        onItem={onItem}
      />
    </section>
  );
}
