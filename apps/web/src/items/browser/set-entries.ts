import type { Catalog, EquipmentItem, EquipmentSet } from "@dofus/shared";

export type SetEntry = { set: EquipmentSet; members: EquipmentItem[]; totals: Record<string, number>; level: number };

/** Every set with its members, full-set totals (members plus the highest tier) and level, by level then name. */
export function setEntries(catalog: Catalog): SetEntry[] {
  const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
  return catalog.sets.map((set) => {
    const members = set.itemIds.flatMap((id) => itemsById.get(id) ?? []);
    const totals: Record<string, number> = { ...set.bonuses.at(-1)?.stats };
    for (const item of members) for (const [key, value] of Object.entries(item.stats)) totals[key] = (totals[key] ?? 0) + value;
    return { set, members, totals, level: Math.max(0, ...members.map((item) => item.level)) };
  }).sort((a, b) => a.level - b.level || a.set.name.localeCompare(b.set.name, "fr"));
}
