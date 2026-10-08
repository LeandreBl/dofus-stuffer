import type { Constraint } from "@dofus/shared";

const labels: Record<Constraint["relation"], string> = {
  atLeast: "Au moins",
  atMost: "Au plus",
  maximize: "Le plus possible",
  minimize: "Le moins cher",
};

export function RelationPicker({ draft, label, update }: {
  draft: Constraint;
  label: string;
  update: (changes: Partial<Constraint>) => void;
}) {
  const relations: Constraint["relation"][] = draft.kind === "price" ? ["atMost", "minimize"] : ["atLeast", "atMost", "maximize"];
  return (
    <div className="segment" aria-label={label}>
      {relations.map((relation) => (
        <button
          key={relation}
          className={draft.relation === relation ? "active" : ""}
          onClick={() => update({ relation })}
        >
          {labels[relation]}
        </button>
      ))}
    </div>
  );
}
