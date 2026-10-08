import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, SlidersHorizontal } from "lucide-react";
import type { BuildEvaluation, Catalog, Constraint } from "@dofus/shared";
import { PriorityRow } from "./PriorityRow";

/** Renumbers priority levels to 0..n-1, keeping their order. */
const normalize = (rows: Constraint[]) => {
  const all = Array.from(new Set(rows.map((entry) => entry.priority))).sort((a, b) => a - b);
  return rows.map((entry) => ({ ...entry, priority: all.indexOf(entry.priority) }));
};

export function Priorities({
  catalog,
  constraints,
  onChange,
  onEdit,
  saved,
  evaluation,
}: {
  catalog: Catalog;
  constraints: Constraint[];
  onChange: (value: Constraint[]) => void;
  onEdit: (value: Constraint) => void;
  saved: boolean;
  evaluation: BuildEvaluation;
}) {
  const populated = Array.from(new Set(constraints.map((entry) => entry.priority))).sort((a, b) => a - b);
  const [extraLevel, setExtraLevel] = useState(false);
  const levels =
    extraLevel || !populated.length
      ? [...populated, (populated.at(-1) ?? -1) + 1]
      : populated;
  const [over, setOver] = useState<number | null>(null);
  const move = (id: string, target: number) => {
    onChange(normalize(constraints.map((entry) => entry.id === id ? { ...entry, priority: target } : entry)));
    setExtraLevel(false);
  };
  function reorder(index: number, direction: number) {
    const from = levels[index],
      to = levels[index + direction];
    if (to === undefined) return;
    onChange(
      normalize(
        constraints.map((entry) => ({
          ...entry,
          priority: entry.priority === from ? to : entry.priority === to ? from : entry.priority,
        })),
      ),
    );
  }
  return (
    <section className="panel priorities-panel">
      <div className="panel-head">
        <h2>
          <SlidersHorizontal size={17} /> Mes priorités
        </h2>
        <span className="counter">{constraints.length} critères</span>
      </div>
      <p className="priority-help">
        Le plus important en haut. Regroupe les critères pour leur donner la
        même importance.
      </p>
      {!constraints.length && (
        <div className="empty-state">
          <SlidersHorizontal size={20} />
          <p>Aucun critère pour l’instant. Choisis ce que tu vises pour lancer une recherche.</p>
        </div>
      )}
      {levels.map((level, index) => (
        <div className="priority-level" key={level}>
          <div className="priority-level-head">
            <span className="level-number">{index + 1}</span>
            <span>{index === 0 ? "EN PREMIER" : index === 1 ? "PUIS" : "ENSUITE"}</span>
            <div className="level-actions">
              <button
                className="icon-button"
                disabled={index === 0}
                onClick={() => reorder(index, -1)}
                aria-label={`Monter le niveau ${index + 1}`}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-button"
                disabled={index === levels.length - 1}
                onClick={() => reorder(index, 1)}
                aria-label={`Descendre le niveau ${index + 1}`}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          </div>
          <div
            className={`priority-drop ${over === level ? "drag-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(level);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              move(event.dataTransfer.getData("text/plain"), level);
              setOver(null);
            }}
          >
            {constraints
              .filter((entry) => entry.priority === level)
              .map((criterion) => (
                <PriorityRow
                  key={criterion.id}
                  catalog={catalog}
                  criterion={criterion}
                  evaluation={evaluation}
                  level={level}
                  levels={levels}
                  onEdit={() => onEdit(criterion)}
                  onMove={(target) => move(criterion.id, target)}
                  onRemove={() => onChange(normalize(constraints.filter((entry) => entry.id !== criterion.id)))}
                  onDragEnd={() => setOver(null)}
                />
              ))}
            {!constraints.some((entry) => entry.priority === level) && (
              <div className="empty-drop">Dépose un critère ici</div>
            )}
          </div>
        </div>
      ))}
      <button className="new-level" onClick={() => setExtraLevel(true)} disabled={extraLevel}>
        <Plus size={13} /> Ajouter un niveau de priorité
      </button>
      <div className="priority-footer">
        <Check size={12} />{" "}
        {saved ? "Enregistré automatiquement dans ce navigateur" : "Sauvegarde locale indisponible"}
      </div>
    </section>
  );
}
