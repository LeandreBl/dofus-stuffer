import type { Build, Slot } from "@dofus/shared";
import type { LookDict } from "@dofus/renderer";

export type CharacterGender = "male" | "female";
export interface CharacterManifest {
  version: string;
  revision: string;
  assetBase: string;
  breeds: Record<string, Record<CharacterGender, { skins: number[]; colors: number[] }>>;
  items: Record<string, { male: number; female: number; folder: string; category: string; petType: string | null }>;
}

export const APPEARANCE_SLOTS: Slot[] = ["hat", "cape", "shield", "weapon", "pet"];

/** Assemble native models from explicit ids. Stats and inventory icons are unrelated to looks. */
export function characterLook(manifest: CharacterManifest, classId: number, gender: CharacterGender, slots: Build["slots"]) {
  const breed = manifest.breeds[classId]?.[gender];
  if (!breed) throw new Error("Cette classe n’a pas encore de modèle disponible.");
  const look: LookDict = {
    bonesId: 1,
    skins: [...breed.skins],
    scales: [100],
    indexedColors: breed.colors.map((color, index) => ((index + 1) << 24) | color),
  };
  const missing: Slot[] = [];
  for (const slot of APPEARANCE_SLOTS.filter((slot) => slot !== "pet")) {
    const id = slots[slot];
    if (!id) continue;
    const item = manifest.items[id];
    if (!item || item.folder !== "skins" || item.category !== slot) {
      missing.push(slot);
      continue;
    }
    look.skins!.push(item[gender]);
  }
  let root = look;
  if (slots.pet) {
    const pet = manifest.items[slots.pet];
    if (!pet || pet.folder !== "bones" || !["familier", "montilier"].includes(pet.petType || "")) {
      missing.push("pet");
    } else {
      const petLook: LookDict = { bonesId: pet[gender], indexedColors: look.indexedColors, scales: [100] };
      if (pet.petType === "familier") {
        look.subEntities = [{ bindingPointCategory: "PET", subEntityLook: petLook }];
      } else {
        // The game's mounted rider skeleton bends the legs into the saddle.
        look.bonesId = 2;
        petLook.subEntities = [{ bindingPointCategory: "MOUNT_DRIVER", subEntityLook: look }];
        root = petLook;
      }
    }
  }
  return { look: root, missing };
}
