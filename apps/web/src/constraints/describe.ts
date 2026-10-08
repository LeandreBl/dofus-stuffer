import { canIncludePower, type Catalog, type Constraint } from "@dofus/shared";
import { fmt, money } from "../lib/format";

export function constraintName(
  catalog: Catalog,
  criterion: Constraint,
): string {
  return criterion.kind === "price"
    ? "Budget du stuff"
    : criterion.kind === "weapon"
      ? `Arme équipée · ${criterion.metric === "criticalChance" ? "Critique %" : "Dégâts"}`
    : criterion.kind === "spell"
      ? `${catalog.spells.find((spell) => spell.id === criterion.spellId)?.name || "Sort inconnu"} · ${criterion.metric === "criticalChance" ? "Critique %" : "Dégâts"}`
      : `${catalog.stats.find((stat) => stat.key === criterion.statKey)?.name || criterion.statKey || "Caractéristique"}${criterion.includePower && canIncludePower(criterion) ? " · avec puissance" : ""}`;
}
export function constraintTarget(criterion: Constraint): string {
  const relation = {
    atLeast: "Au moins",
    atMost: "Au plus",
    maximize: "Maximiser",
    minimize: "Minimiser",
  }[criterion.relation];
  if ((criterion.kind === "spell" || criterion.kind === "weapon") && criterion.metric === "criticalChance") {
    return `${relation}${["maximize", "minimize"].includes(criterion.relation) ? "" : ` ${fmt(criterion.target)} %`} · chance de critique`;
  }
  return `${relation}${["maximize", "minimize"].includes(criterion.relation) ? "" : ` ${criterion.kind === "price" ? money(criterion.target) : fmt(criterion.target)}`}${criterion.kind === "spell" || criterion.kind === "weapon" ? ` · ${criterion.mode === "critical" ? "critique" : "normal"} · ${(criterion.metric || "average") === "average" ? "moyenne" : criterion.metric === "max" ? "jet max." : "jet min."}${criterion.kind === "spell" && criterion.turnOffset ? ` · T+${criterion.turnOffset}` : ""}` : ""}`;
}
