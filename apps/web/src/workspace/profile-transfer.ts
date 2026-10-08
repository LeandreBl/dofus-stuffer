import { getCharacterAllocation, type Build, type Catalog, type Character } from "@dofus/shared";
import { restoreState, validSlots, type SavedState } from "./storage";

/** Profile file contents, validated and migrated like a saved workspace; throws when it is not one. */
export function parseProfile(catalog: Catalog, text: string, fallback: SavedState): SavedState {
  const restored = restoreState(catalog, JSON.parse(text), fallback);
  if (!restored) throw new Error("Ce fichier n’est pas un profil Dofus Stuffer valide.");
  return restored;
}

/** Stuff file contents restricted to this catalog; throws when no item remains. */
export function parseStuff(catalog: Catalog, text: string, character: Character): { build: Build; ignored: number } {
  const imported = JSON.parse(text)?.build;
  const slots = validSlots(catalog, imported?.slots);
  const ignored = Object.keys(imported?.slots || {}).length - Object.keys(slots).length;
  if (!Object.keys(slots).length) throw new Error("Ce fichier ne contient pas de stuff Dofus Stuffer valide.");
  const baseStats = imported.baseStats && typeof imported.baseStats === "object" && getCharacterAllocation({ ...character, baseStats: imported.baseStats }).valid ? imported.baseStats : undefined;
  const exoBonuses = Array.isArray(imported.exoBonuses) ? [...new Set(imported.exoBonuses.filter((exo: unknown) => exo === "actionPoints" || exo === "movementPoints"))] as Build["exoBonuses"] : [];
  return { build: { slots, baseStats, exoBonuses }, ignored };
}
