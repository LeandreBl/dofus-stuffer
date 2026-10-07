import type { Catalog, OptimizationRequest, Slot } from "@dofus/shared";

/** A kept item must remain available to the search, even after earlier exclusions. */
export function withEquipmentLocks(
  request: OptimizationRequest,
  catalog: Catalog,
  lockedSlots: Partial<Record<Slot, number>>,
): OptimizationRequest {
  const ids = new Set(Object.values(lockedSlots));
  const items = catalog.items.filter((item) => ids.has(item.id));
  const types = new Set(items.map((item) => item.typeId));
  const categories = new Set(items.map((item) => item.category));
  return {
    ...request,
    filters: {
      ...request.filters,
      lockedSlots: { ...lockedSlots },
      excludedItemIds: request.filters.excludedItemIds.filter((id) => !ids.has(id)),
      excludedTypeIds: request.filters.excludedTypeIds.filter((id) => !types.has(id)),
      excludedCategories: request.filters.excludedCategories.filter((category) => !categories.has(category)),
      allowedItemIds: request.filters.allowedItemIds
        ? [...new Set([...request.filters.allowedItemIds, ...items.map((item) => item.id)])]
        : undefined,
    },
  };
}
