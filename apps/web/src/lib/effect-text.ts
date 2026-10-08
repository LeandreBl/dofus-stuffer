import type { Catalog, RawEffect } from "@dofus/shared";
import { fmt, plainText } from "./format";

/** Game description with its {{spell,…::name}} links reduced to their names. */
export const readableText = (text: string) => plainText(text.replace(/\{\{(?:spell|item),[^:]+::([^}]+)\}\}/g, "$1")).trim();
export function weaponEffectText(effect: RawEffect, catalog?: Catalog) {
  const low = effect.diceNum || effect.value, high = effect.diceSide || low;
  // Spell modifiers ("#1 : +#3 dégâts de base") put the targeted spell id in #1.
  const spellName = catalog && /^#1\s*:/.test(effect.description || "") ? catalog.spells.find(spell => spell.id === effect.diceNum)?.name || `Sort ${effect.diceNum}` : undefined;
  return readableText((effect.description || "")
    .replace(/^#1(?=\s*:)/, spellName ?? "#1")
    .replace(/\{\{~1~2([^}]*)\}\}#2/g, (_, sep) => high !== low ? `${sep}${fmt(high)}` : "")
    .replace(/\{\{~[^}]*\}\}/g, "")
    .replace(/#1/g, fmt(low)).replace(/#2/g, fmt(high)).replace(/#3/g, fmt(effect.value)));
}
