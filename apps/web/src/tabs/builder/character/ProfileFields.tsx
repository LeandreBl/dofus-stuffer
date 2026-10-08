import { Minus, Plus } from "lucide-react";
import type { Catalog } from "@dofus/shared";
import { ServerSelect } from "../../../components/ServerSelect";

export function ProfileFields({ catalog, level, server, onLevel, onServer }: {
  catalog: Catalog;
  level: number;
  server: string;
  onLevel: (level: number) => void;
  onServer: (server: string) => void;
}) {
  const changeLevel = (value: number) =>
    onLevel(Math.max(1, Math.min(200, Math.trunc(Number.isFinite(value) ? value : 1))));
  return (
    <div className="profile-fields">
      <div className="inline-field">
        <label htmlFor="character-level">Niveau</label>
        <div className="level-stepper">
          <button onClick={() => changeLevel(level - 1)} aria-label="Réduire le niveau">
            <Minus size={12} />
          </button>
          <input
            id="character-level"
            type="number"
            min="1"
            max="200"
            value={level}
            onChange={(event) => changeLevel(Number(event.target.value))}
          />
          <button onClick={() => changeLevel(level + 1)} aria-label="Augmenter le niveau">
            <Plus size={12} />
          </button>
        </div>
      </div>
      <div className="inline-field">
        <label htmlFor="server-select">Serveur</label>
        <ServerSelect id="server-select" catalog={catalog} server={server} onChange={onServer} />
      </div>
      <div className="inline-field">
        <span className="section-help">Niveau rapide</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[100, 150, 200].map((preset) => (
            <button
              className={`button small ${level === preset ? "primary" : "ghost"}`}
              key={preset}
              onClick={() => changeLevel(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
