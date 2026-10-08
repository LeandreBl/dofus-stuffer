import type { Build, EquipmentItem, Slot } from "@dofus/shared";

export const slotNames: Record<Slot, string> = {
  amulet: "Amulette",
  ring1: "Anneau",
  ring2: "Anneau",
  hat: "Coiffe",
  cape: "Cape",
  belt: "Ceinture",
  boots: "Bottes",
  weapon: "Arme",
  shield: "Bouclier",
  pet: "Familier / monture",
  dofus1: "Dofus / trophée",
  dofus2: "Dofus / trophée",
  dofus3: "Dofus / trophée",
  dofus4: "Dofus / trophée",
  dofus5: "Dofus / trophée",
  dofus6: "Dofus / trophée",
};

/** First free slot for this item, or the first slot of its kind. */
export function chooseSlot(item: EquipmentItem, build: Build): Slot {
  if (item.slotType === "ring")
    return !build.slots.ring1
      ? "ring1"
      : !build.slots.ring2
        ? "ring2"
        : "ring1";
  if (item.slotType === "dofus")
    return (
      ([1, 2, 3, 4, 5, 6].map((value) => `dofus${value}`) as Slot[]).find(
        (slot) => !build.slots[slot],
      ) || "dofus1"
    );
  return item.slotType as Slot;
}
