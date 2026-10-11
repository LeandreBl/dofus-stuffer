import { getCharacterAllocation, type Build, type Catalog, type Character } from "@dofus/shared";
import { validSlots } from "./storage";

/** Stuff file contents restricted to this catalog; throws when no item remains. */
export function parseStuff(catalog: Catalog, text: string, character: Character): { build: Build; ignored: number } {
  const imported = JSON.parse(text)?.build;
  const slots = validSlots(catalog, imported?.slots);
  const ignored = Object.keys(imported?.slots || {}).length - Object.keys(slots).length;
  if (!Object.keys(slots).length) throw new Error("Ce fichier ne contient pas de stuff Dofus Stuffer valide.");
  const baseStats = imported.baseStats && typeof imported.baseStats === "object" && getCharacterAllocation({ ...character, baseStats: imported.baseStats }).valid ? imported.baseStats : undefined;
  const exoBonuses = Array.isArray(imported.exoBonuses) ? [...new Set(imported.exoBonuses.filter((exo: unknown) => exo === "actionPoints" || exo === "movementPoints"))] as Build["exoBonuses"] : [];
  const extraStats = imported.extraStats && typeof imported.extraStats === "object" ? Object.fromEntries(Object.entries(imported.extraStats).filter(([key, value]) => catalog.stats.some((stat) => stat.key === key) && Number.isFinite(value))) as Build["extraStats"] : undefined;
  return { build: { slots, baseStats, exoBonuses, extraStats }, ignored };
}
