import type { HTMLAttributes, ReactElement } from "react";
import { getSpellLevel, type Catalog, type Spell } from "@dofus/shared";
import { HoverCard } from "../../components/HoverCard";
import { SpellSummary } from "./SpellSummary";

/** Spell summary on hover or focus of any trigger. */
export function SpellHover({ spell, characterLevel, catalog, children }: {
  spell: Spell; characterLevel: number; catalog: Catalog; children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const level = getSpellLevel(spell, characterLevel);
  return <HoverCard label={`Aperçu de ${spell.name}`} content={level && <SpellSummary spell={spell} level={level} catalog={catalog} />}>{children}</HoverCard>;
}
