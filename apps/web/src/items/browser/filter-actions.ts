import type { Build, EquipmentItem, OptimizationRequest, Slot } from "@dofus/shared";
import { chooseSlot } from "../slots";

export const isExcluded = (request: OptimizationRequest, item: EquipmentItem) =>
  request.filters.excludedItemIds.includes(item.id) ||
  request.filters.excludedTypeIds.includes(item.typeId) ||
  request.filters.excludedCategories.includes(item.category);

/** Excludes the item (and unlocks it), or lifts every exclusion that hides it. */
export function toggleExcluded(request: OptimizationRequest, item: EquipmentItem): OptimizationRequest {
  const excluded = isExcluded(request, item);
  const locked = { ...request.filters.lockedSlots };
  if (!excluded)
    Object.keys(locked).forEach((key) => {
      if (locked[key as Slot] === item.id) delete locked[key as Slot];
    });
  return {
    ...request,
    filters: {
      ...request.filters,
      lockedSlots: locked,
      excludedCategories: excluded
        ? request.filters.excludedCategories.filter((value) => value !== item.category)
        : request.filters.excludedCategories,
      excludedTypeIds: excluded
        ? request.filters.excludedTypeIds.filter((value) => value !== item.typeId)
        : request.filters.excludedTypeIds,
      excludedItemIds: excluded
        ? request.filters.excludedItemIds.filter((id) => id !== item.id)
        : [...request.filters.excludedItemIds, item.id],
    },
  };
}

/** Locks the item in a slot (the given one, its equipped one or a free one), or unlocks it. */
export function toggleLock(request: OptimizationRequest, build: Build, item: EquipmentItem, slot?: Slot): OptimizationRequest {
  const lockedSlots = { ...request.filters.lockedSlots };
  const current = slot
    ? (lockedSlots[slot] === item.id ? slot : undefined)
    : (Object.keys(lockedSlots) as Slot[]).find((key) => lockedSlots[key] === item.id);
  if (current) {
    delete lockedSlots[current];
  } else {
    const destination =
      slot || (Object.keys(build.slots) as Slot[]).find((key) => build.slots[key] === item.id) || chooseSlot(item, { slots: { ...build.slots, ...lockedSlots } });
    lockedSlots[destination] = item.id;
  }
  return {
    ...request,
    filters: {
      ...request.filters,
      lockedSlots,
      excludedItemIds: request.filters.excludedItemIds.filter((id) => id !== item.id),
      excludedCategories: request.filters.excludedCategories.filter((value) => value !== item.category),
      excludedTypeIds: request.filters.excludedTypeIds.filter((value) => value !== item.typeId),
    },
  };
}

export function toggleTypeExclusion(request: OptimizationRequest, typeId: number): OptimizationRequest {
  const excluded = request.filters.excludedTypeIds.includes(typeId);
  return {
    ...request,
    filters: {
      ...request.filters,
      excludedTypeIds: excluded
        ? request.filters.excludedTypeIds.filter((value) => value !== typeId)
        : [...request.filters.excludedTypeIds, typeId],
    },
  };
}
