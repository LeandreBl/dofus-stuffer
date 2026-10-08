import type { Constraint } from "@dofus/shared";

/** Hit type, targeted roll and, for a spell, the cast turn. */
export function DamageRollOptions({ draft, update }: {
  draft: Constraint;
  update: (changes: Partial<Constraint>) => void;
}) {
  return (
    <>
      <div className="modal-options">
        <label className="field">
          Type de coup
          <select
            value={draft.mode || "normal"}
            onChange={(event) => update({ mode: event.target.value as Constraint["mode"] })}
          >
            <option value="normal">Normal</option>
            <option value="critical">Critique</option>
          </select>
        </label>
        <label className="field">
          Jet ciblé
          <select
            value={draft.metric || "average"}
            onChange={(event) => update({ metric: event.target.value as Constraint["metric"] })}
          >
            <option value="min">Minimum</option>
            <option value="average">Moyen</option>
            <option value="max">Maximum</option>
          </select>
        </label>
      </div>
      {draft.kind === "spell" && <label className="field">
        Moment du lancer
        <select
          value={draft.turnOffset || 0}
          onChange={(event) => update({ turnOffset: Number(event.target.value) })}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((turn) => (
            <option key={turn} value={turn}>
              {turn ? `Relance à T+${turn}, en relançant dès que possible` : "Premier lancer"}
            </option>
          ))}
        </select>
      </label>}
    </>
  );
}
