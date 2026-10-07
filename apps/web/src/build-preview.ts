import type { OptimizationRequest } from "@dofus/shared";

/** The mannequin can be edited freely. Search equipment and exo filters remain in the atelier;
 * equipment prerequisites, game caps, objectives and prices still apply here. */
export function manualBuildRequest(request: OptimizationRequest): OptimizationRequest {
  return {
    ...request,
    filters: {
      ...request.filters,
      excludedItemIds: [], excludedTypeIds: [], excludedCategories: [],
      allowedItemIds: undefined, lockedSlots: {},
      maxExos: 2, allowedExos: ["actionPoints", "movementPoints"],
    },
  };
}
