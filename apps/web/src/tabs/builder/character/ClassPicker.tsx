import { Check } from "lucide-react";
import type { Catalog } from "@dofus/shared";
import { GameImage } from "../../../components/GameImage";

export function ClassPicker({ catalog, classId, onChange }: {
  catalog: Catalog;
  classId: number;
  onChange: (classId: number) => void;
}) {
  const currentClass = catalog.classes.find((gameClass) => gameClass.id === classId);
  return (
    <div>
      <div className="section-label">CHOISIR UNE CLASSE</div>
      <div className="class-grid">
        {catalog.classes.map((gameClass) => (
          <button
            className={`class-tile ${classId === gameClass.id ? "selected" : ""}`}
            key={gameClass.id}
            title={gameClass.name}
            aria-label={gameClass.name}
            aria-pressed={classId === gameClass.id}
            onClick={() => onChange(gameClass.id)}
          >
            <GameImage src={gameClass.icon} />
          </button>
        ))}
      </div>
      <div className="class-name">
        <Check size={11} />
        {currentClass?.name} sélectionné
      </div>
    </div>
  );
}
