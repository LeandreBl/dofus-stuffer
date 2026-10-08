import { getStatConstraintValue, type Catalog, type Constraint, type Stats } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";

export function PowerOption({ draft, catalog, stats, update }: {
  draft: Constraint;
  catalog: Catalog;
  stats: Stats;
  update: (changes: Partial<Constraint>) => void;
}) {
  const stat = catalog.stats.find((entry) => entry.key === draft.statKey);
  return <>
    <div className="check-field">
      <StatIcon stat={catalog.stats.find((entry) => entry.key === "damagePercent")} />
      <label htmlFor={`power-target-${draft.id}`}>
        Avec puissance
        <small>Ajoute la puissance permanente à cette caractéristique pour évaluer l’objectif.</small>
      </label>
      <input id={`power-target-${draft.id}`} type="checkbox" aria-label="Avec puissance" checked={!!draft.includePower}
        onChange={(event) => update({ includePower: event.target.checked })} />
    </div>
    <p className="inline-notice" aria-live="polite">
      {draft.includePower ? <><strong>Actuellement : {fmt(stats[draft.statKey!] || 0)} {stat?.name} + {fmt(stats.damagePercent || 0)} Puissance = {fmt(getStatConstraintValue(draft, stats))} pour les dégâts.</strong><br />Cette option ne modifie ni les prérequis des objets, ni la prospection, les soins, le tacle ou la fuite. Les boosts temporaires sont exclus.</>
        : <>Actuellement : {fmt(getStatConstraintValue(draft, stats))} {stat?.name}, puissance exclue.</>}
    </p>
  </>;
}
