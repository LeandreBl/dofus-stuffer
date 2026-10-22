import { X } from "lucide-react";
import { FM_EFFECTS, fmLineCap, fmValueWeight, type Catalog, type FmLine, type FmValues } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";

export function ForgeLines({ catalog, lines, values, targets, onValue, onTarget, onAddExo, onRemoveExo }: {
  catalog: Catalog;
  lines: FmLine[];
  values: FmValues;
  targets: FmValues;
  onValue: (effectId: number, value: number) => void;
  onTarget: (effectId: number, value: number) => void;
  onAddExo: (effectId: number) => void;
  onRemoveExo: (effectId: number) => void;
}) {
  const stat = (key: string) => catalog.stats.find((entry) => entry.key === key);
  const free = Object.entries(FM_EFFECTS).filter(([id]) => !lines.some((line) => line.effectId === Number(id)));
  return (
    <>
      <div className="forge-table-wrap">
        <table className="forge-table">
          <thead>
            <tr><th>Caractéristique</th><th>Jet</th><th>Actuel</th><th>Objectif</th><th>Poids</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const definition = stat(line.stat), target = targets[line.effectId] ?? 0, cap = fmLineCap(line);
              const tag = line.exo ? "Exo" : target > line.max ? "Over" : "";
              return (
                <tr key={line.effectId} className={target > cap ? "invalid" : ""}>
                  <td><span className="forge-stat"><StatIcon stat={definition} />{definition?.name || line.stat}{tag && <em>{tag}</em>}</span></td>
                  <td>{line.exo ? "—" : `${fmt(line.min)} à ${fmt(line.max)}`}</td>
                  <td><input type="number" step="1" aria-label={`Valeur actuelle ${definition?.name || line.stat}`} value={values[line.effectId] ?? 0} onChange={(event) => onValue(line.effectId, Math.trunc(Number(event.target.value)) || 0)} /></td>
                  <td><input type="number" step="1" max={cap} aria-label={`Objectif ${definition?.name || line.stat}`} value={target} onChange={(event) => onTarget(line.effectId, Math.trunc(Number(event.target.value)) || 0)} /></td>
                  <td title={`Plafond : ${fmt(cap)}`}>{fmt(fmValueWeight(line, values[line.effectId] ?? 0))}<small> · {fmt(line.weight)}/pt</small></td>
                  <td>{line.exo && <button className="icon-button" aria-label={`Retirer l’exo ${definition?.name || line.stat}`} onClick={() => onRemoveExo(line.effectId)}><X size={14} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="field forge-exo">Ajouter une caractéristique absente (exo)
        <select value="" onChange={(event) => event.target.value && onAddExo(Number(event.target.value))}>
          <option value="">Choisir une caractéristique…</option>
          {free.map(([id, [key]]) => <option key={id} value={id}>{stat(key)?.name || key}</option>)}
        </select>
      </label>
    </>
  );
}
