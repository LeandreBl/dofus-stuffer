import type { Catalog, OptimizationRequest, Slot } from "@dofus/shared";

/**
 * A kept item must remain available to the search, even after earlier exclusions.
 * Type and category exclusions stay in place: the server exempts locked items from them.
 */
export function withEquipmentLocks(
  request: OptimizationRequest,
  catalog: Catalog,
  lockedSlots: Partial<Record<Slot, number>>,
): OptimizationRequest {
  const ids = new Set(Object.values(lockedSlots));
  const items = catalog.items.filter((item) => ids.has(item.id));
  return {
    ...request,
    filters: {
      ...request.filters,
      lockedSlots: { ...lockedSlots },
      excludedItemIds: request.filters.excludedItemIds.filter((id) => !ids.has(id)),
      allowedItemIds: request.filters.allowedItemIds
        ? [...new Set([...request.filters.allowedItemIds, ...items.map((item) => item.id)])]
        : undefined,
    },
  };
}
