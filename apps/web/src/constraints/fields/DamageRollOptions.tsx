import { getSpellLevel, type Catalog, type Constraint } from "@dofus/shared";

/** Hit type, targeted roll and, for a spell, the cast turn. */
export function DamageRollOptions({ draft, update, catalog, characterLevel }: {
  draft: Constraint;
  update: (changes: Partial<Constraint>) => void;
  catalog: Catalog;
  characterLevel: number;
}) {
  // Only turns the spell can be recast on (e.g. turns 1, 3, 5, 7 for a 2-turn interval).
  const spell = catalog.spells.find((entry) => entry.id === draft.spellId);
  const step = Math.max(1, (spell && getSpellLevel(spell, characterLevel)?.minCastInterval) || 1);
  const current = draft.turnOffset || 0;
  const turns = [0, 1, 2, 3, 4, 5, 6].filter((turn) => turn % step === 0 || turn === current);
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
          value={current}
          onChange={(event) => update({ turnOffset: Number(event.target.value) })}
        >
          {turns.map((turn) => (
            <option key={turn} value={turn}>
              {turn % step ? `Tour ${turn + 1} : impossible, relance tous les ${step} tours` : turn ? `Tour ${turn + 1} · relance dès que possible depuis le tour 1` : "Tour 1 · premier lancer"}
            </option>
          ))}
        </select>
      </label>}
    </>
  );
}
