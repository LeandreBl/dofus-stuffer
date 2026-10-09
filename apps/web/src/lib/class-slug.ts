import type { BuildEvaluation, Catalog, OptimizationRequest } from "@dofus/shared";

/** URL segment of a class page: "Crâ" -> "cra". Shared by the build-time SEO pages and the app. */
export const classSlug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const statTags: Record<string, string> = {
  strength: "terre", intelligence: "feu", chance: "eau", agility: "air", criticalHit: "crit", vitality: "vita",
  wisdom: "sagesse", actionPoints: "pa", movementPoints: "pm", range: "po", initiative: "ini",
};
const words = (text: string) => classSlug(text).split(/[^a-z0-9]+/).filter((word) => word && !/^(panoplie|de|du|des|la|le|les|l|d)$/.test(word));

/** Short export name, e.g. `iop-200-feu-crit-oplate.json`: class, level, top objectives, main set. */
export function stuffFilename(catalog: Catalog, request: OptimizationRequest, evaluation: BuildEvaluation) {
  const gameClass = catalog.classes.find((entry) => entry.id === request.character.classId);
  const objectives = [...request.constraints].filter((constraint) => constraint.kind !== "price").sort((a, b) => a.priority - b.priority);
  const tags = [...new Set(objectives.map((constraint) => {
    if (constraint.statKey) return statTags[constraint.statKey] ?? words(catalog.stats.find((stat) => stat.key === constraint.statKey)?.name || "")[0];
    if (constraint.kind === "spell") return words(catalog.spells.find((spell) => spell.id === constraint.spellId)?.name || "")[0];
    return constraint.kind === "weapon" ? "arme" : undefined;
  }).filter(Boolean))].slice(0, 3);
  const mainSet = [...evaluation.sets].sort((a, b) => b.count - a.count)[0];
  const parts = [gameClass && words(gameClass.name)[0], request.character.level, ...tags, ...(mainSet && mainSet.count >= 2 ? words(mainSet.name).slice(0, 2) : [])];
  return `${parts.filter(Boolean).join("-") || "stuff"}.json`;
}
