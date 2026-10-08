import { ArrowUpRight, ChevronRight, Layers3, Package } from "lucide-react";
import type { Catalog, OptimizationRequest } from "@dofus/shared";
import { CategoryToggles } from "./CategoryToggles";
import { ExoFilters } from "./ExoFilters";

export function EquipmentFilters({
  catalog,
  request,
  onChange,
  onBrowse,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
  onBrowse: () => void;
}) {
  const excludedCount = request.filters.excludedItemIds.length;
  const lockedCount = Object.keys(request.filters.lockedSlots).length;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>
            <Package size={17} /> Objets autorisés
          </h2>
          <p>Garde le contrôle sur ce que le moteur peut équiper.</p>
        </div>
        <button className="icon-button" onClick={onBrowse} aria-label="Ouvrir le catalogue d’objets">
          <ArrowUpRight size={18} />
        </button>
      </div>
      <CategoryToggles catalog={catalog} request={request} onChange={onChange} />
      <ExoFilters catalog={catalog} request={request} onChange={onChange} />
      <div className="profile-actions">
        <button className="button ghost small" onClick={onBrowse}>
          <Layers3 size={13} /> Filtrer les objets et les types{" "}
          <ChevronRight size={13} />
        </button>
        {excludedCount > 0 && <span className="counter">{excludedCount} exclus</span>}
        {lockedCount > 0 && <span className="counter">{lockedCount} verrouillés</span>}
      </div>
    </section>
  );
}
