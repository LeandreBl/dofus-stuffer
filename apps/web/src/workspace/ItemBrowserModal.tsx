import type { Build, Catalog, EquipmentItem, OptimizationRequest, Slot } from "@dofus/shared";
import { Modal } from "../components/Modal";
import { ItemBrowser } from "../items/browser/ItemBrowser";

export function ItemBrowserModal({ slot, catalog, request, build, onChange, onEquip, onItem, onClose }: {
  /** Restricts the catalog to the items of this slot. */
  slot?: Slot;
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem, slot?: Slot) => void;
  onItem: (item: EquipmentItem) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={slot ? "Choisir un objet pour cet emplacement" : "Catalogue des équipements"} onClose={onClose} wide>
      <p>
        Équipe un objet, impose-le à l’optimiseur ou exclus-le de tes
        recherches.
      </p>
      <ItemBrowser catalog={catalog} request={request} build={build} onChange={onChange} onEquip={onEquip} onItem={onItem} slot={slot} />
    </Modal>
  );
}
