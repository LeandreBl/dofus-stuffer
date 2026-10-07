import { getSpellLevel, getSpellElements, type Catalog, type Element, type Spell } from "@dofus/shared";

const elementOrder: Element[] = ["earth", "fire", "water", "air", "neutral"];

// Damage effect families from data/effects-map.json. The importer also assigns
// elements to healing, characteristics and resistances, so element alone is
// insufficient. Keep periodic and conditional damage even when the simulator
// cannot guarantee its value.
const damageEffects: Record<Element, number[]> = {
  earth: [86, 92, 97, 276, 1016, 1063, 1070, 1096, 1122, 1128, 1135, 1140, 1228],
  fire: [88, 94, 99, 278, 1015, 1066, 1069, 1094, 1120, 1126, 1133, 1138, 1226],
  water: [85, 91, 96, 275, 1014, 1065, 1068, 1095, 1121, 1127, 1132, 1137, 1227],
  air: [87, 93, 98, 277, 1013, 1064, 1067, 1093, 1119, 1125, 1131, 1136, 1225],
  neutral: [
    82, 89, 95, 100, 144, 279, 671, 672, 1012, 1071, 1092, 1118, 1124,
    1134, 1139, 1224,
  ],
};
const damageElementById = new Map<number, Element>(
  elementOrder.flatMap((element) =>
    damageEffects[element].map((id): [number, Element] => [id, element]),
  ),
);

/** Metadata filter, independent of damage simulation support. An empty result
 * means no identified elemental damage; it does not prove the spell is harmless
 * (some effects delegate damage to unavailable sub-spells or a dynamic element).
 */
export function getSpellDamageElements(
  spell: Spell,
  characterLevel: number,
  catalog?: Catalog,
): Element[] {
  if (catalog?.combatSpells?.length) return getSpellElements(spell, characterLevel, catalog);
  const level =
    getSpellLevel(spell, characterLevel) ??
    [...spell.levels].sort(
      (a, b) => a.minPlayerLevel - b.minPlayerLevel || a.grade - b.grade,
    )[0];
  if (!level) return [];

  const found = new Set<Element>();
  for (const effect of [...level.effects, ...level.criticalEffects]) {
    const fallbackElement = damageElementById.get(effect.effectId);
    // A cost paid by damaging the caster is not the spell's offensive element.
    if (!fallbackElement || effect.targetMask === "C") continue;
    found.add(effect.element ?? fallbackElement);
  }
  return elementOrder.filter((element) => found.has(element));
}
