import { Swords } from "lucide-react";
import type { Catalog, Constraint, EquipmentItem } from "@dofus/shared";
import { GameImage } from "../components/GameImage";
import { StatIcon } from "../components/StatIcon";

export function CriterionIcon({
  catalog,
  criterion,
  weapon,
}: {
  catalog: Catalog;
  criterion: Constraint;
  weapon?: EquipmentItem;
}) {
  if (criterion.kind === "weapon") return <span className="stat-icon">{weapon?.icon ? <GameImage src={weapon.icon} /> : <Swords size={19} />}</span>;
  return (
    <StatIcon
      price={criterion.kind === "price"}
      stat={catalog.stats.find((stat) => stat.key === criterion.statKey)}
      spell={catalog.spells.find((spell) => spell.id === criterion.spellId)}
    />
  );
}
