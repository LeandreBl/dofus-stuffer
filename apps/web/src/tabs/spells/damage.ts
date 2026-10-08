import type { calculatePreviewSpellDamage, DamageRange, Element } from "@dofus/shared";
import { fmt } from "../../lib/format";

export const elementKeys: Record<Element, string> = {
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
  neutral: "neutralDamageBonus",
};
export const elementNames: Record<Element, string> = {
  earth: "Terre",
  fire: "Feu",
  water: "Eau",
  air: "Air",
  neutral: "Neutre",
};
export const rangeLabel = (range: DamageRange | null | undefined) =>
  range ? `${fmt(range.min)} – ${fmt(range.max)}` : "—";

/** Spell damage with the critical chance of each recast turn. */
export type PreviewSpellDamage = ReturnType<typeof calculatePreviewSpellDamage>;
