import type { Build, Catalog, Character, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt } from "../../../lib/format";
import { CharacterPreview } from "./CharacterPreview";

const essentials: [string, string][] = [["actionPoints", "PA"], ["movementPoints", "PM"], ["range", "PO"]];

/** Character model between the slot columns, with its AP / MP / range. */
export function AvatarStage({ catalog, character, stats, slots }: {
  catalog: Catalog;
  character: Character;
  stats: Stats;
  slots: Build["slots"];
}) {
  const currentClass = catalog.classes.find((entry) => entry.id === character.classId);
  return (
    <div className="avatar-stage">
      <div className="essentials">
        {essentials.map(([key, unit]) => {
          const stat = catalog.stats.find((entry) => entry.key === key);
          return (
            <span className="essential" key={key} title={`${stat?.name || key} actuels`}>
              <StatIcon stat={stat} />
              {fmt(stats[key] || 0)} <small>{unit}</small>
            </span>
          );
        })}
      </div>
      <div className="avatar-glow" />
      <CharacterPreview gameClass={currentClass} slots={slots} />
      <div className="avatar-caption">
        {currentClass?.name}{" "}
        <small>Niveau {character.level}</small>
      </div>
    </div>
  );
}
