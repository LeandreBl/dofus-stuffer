import type { Catalog, Spell, SpellLevel } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { HoverCard } from "../../components/HoverCard";
import { SpellSummary } from "./SpellSummary";

/** Spell icon with its tooltip on hover or focus. */
export function SpellImage({ spell, level, catalog }: { spell: Spell; level?: SpellLevel; catalog: Catalog }) {
  return <HoverCard label={`Aperçu de ${spell.name}`} content={level && <SpellSummary spell={spell} level={level} catalog={catalog} />}><GameImage src={spell.icon} /></HoverCard>;
}
