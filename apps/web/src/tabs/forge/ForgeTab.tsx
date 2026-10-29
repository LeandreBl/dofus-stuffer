import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Hammer, Info, Scale } from "lucide-react";
import {
  FM_EFFECTS, FM_MODEL, fmAdvice, fmCalibration, fmDetectOutcome, fmEffectLabels, fmHardLines, fmModelOdds, fmExoLine, fmParseScreen, fmItemWeight, fmLineCap, fmLines, fmPerfectWeight, fmRuneWeight, fmValueWeight,
  type Catalog, type EquipmentItem, type FmLine, type FmObservation, type FmOutcome, type FmRune,
} from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { fmt } from "../../lib/format";
import { ForgeAdvice, type ForgeOutcome } from "./ForgeAdvice";
import { ForgeItemPicker } from "./ForgeItemPicker";
import { ForgeLines } from "./ForgeLines";
import { ForgeScreen } from "./ForgeScreen";
import { emptyForge, loadForge, loadForgeLog, saveForge, saveForgeLog } from "./forge-storage";
import { usePlan } from "./usePlan";

const AP_MP_RANGE = [111, 128, 117];
const outcomeNames: Record<FmOutcome, string> = { clean: "succès critique", partial: "succès neutre", failure: "échec critique" };

export function ForgeTab({ catalog, notify }: { catalog: Catalog; notify: (message: string) => void }) {
  const [session, setSession] = useState(loadForge);
  useEffect(() => saveForge(session), [session]);
  const item = catalog.items.find((entry) => entry.id === session.itemId);
  // Same line order as the in-game tooltip, exos included.
  const lines = useMemo(() => item ? [...fmLines(item), ...session.exos.map(fmExoLine)].sort((a, b) => FM_EFFECTS[a.effectId][2] - FM_EFFECTS[b.effectId][2]) : [], [item, session.exos]);
  const { values, targets, pool } = session;
  const [log, setLog] = useState(loadForgeLog);
  useEffect(() => saveForgeLog(log), [log]);
  const [sharing, setSharing] = useState(false);
  const onSharing = useCallback((value: boolean) => setSharing(value), []);
  const calibration = useMemo(() => fmCalibration(log), [log]);
  // The odds everywhere on the page (and in the planner worker) follow the calibration.
  Object.assign(FM_MODEL, { cleanScale: calibration.cleanScale, failureScale: calibration.failureScale });
  const advice = useMemo(() => fmAdvice(lines, values, targets, "heavy", pool), [lines, values, targets, pool, calibration]);
  const plan = usePlan(lines, values, pool, targets);
  const labels = useMemo(() => fmEffectLabels(catalog), [catalog]);

  function pick(selected: EquipmentItem) {
    const perfect = Object.fromEntries(fmLines(selected).map((line) => [line.effectId, line.max]));
    setSession({ ...emptyForge(), itemId: selected.id, values: perfect, targets: perfect });
  }
  const setValue = (effectId: number, value: number) => setSession((s) => ({ ...s, values: { ...s.values, [effectId]: value } }));
  const setTarget = (effectId: number, value: number) => setSession((s) => ({ ...s, targets: { ...s.targets, [effectId]: value } }));
  const observe = (line: FmLine, rune: FmRune, outcome: FmOutcome, seen: FmObservation["seen"]) =>
    setLog((previous) => [...previous, { ...fmModelOdds(lines, values, line, rune), outcome, seen }]);
  function outcome(rune: FmRune, line: FmLine, result: ForgeOutcome) {
    observe(line, rune, result, "manual");
    const left = pool - fmRuneWeight(rune);
    if (result !== "clean" && left < 0) notify("Le puits ne couvrait pas la rune : corrige la ligne qui a baissé et le puits affiché en jeu.");
    setSession((s) => ({
      ...s,
      values: result === "failure" ? s.values : { ...s.values, [line.effectId]: (s.values[line.effectId] ?? 0) + rune.points },
      pool: result === "clean" ? s.pool : Math.max(0, Math.round(left * 100) / 100),
    }));
  }

  /** Applies what the OCR read on the game window: known lines, new exact lines as exos, the pool. */
  function readScreen(text: string) {
    const read = fmParseScreen(text, labels);
    const known = new Set(lines.map((line) => line.effectId));
    const next = { ...session, values: { ...values }, exos: [...session.exos] };
    let changed = 0;
    for (const [id, value] of Object.entries(read.values)) {
      const effectId = Number(id);
      if (!known.has(effectId) && !(read.exact.has(effectId) && value > 0)) continue;
      if (!known.has(effectId)) next.exos.push(effectId);
      if (next.values[effectId] !== value) { next.values[effectId] = value; changed++; }
    }
    if (read.pool !== undefined && read.pool !== pool) { next.pool = read.pool; changed++; }
    if (!changed) return;
    // What the rune did, for the calibration; a failure's rune is the one that was advised.
    const seen = fmDetectOutcome(lines, { values, pool }, { values: next.values, pool: next.pool });
    const advised = plan.options?.[0] ?? advice;
    const line = seen?.line ?? advised?.line, rune = seen?.rune ?? advised?.rune;
    if (seen && line && rune) observe(line, rune, seen.outcome, "screen");
    setSession(next);
    notify(seen && rune ? `Écran lu : ${outcomeNames[seen.outcome]}${seen.rune ? ` (Rune ${rune.name})` : ""}.` : `Écran lu : ${changed} valeur${changed > 1 ? "s" : ""} mise${changed > 1 ? "s" : ""} à jour.`);
  }

  if (!item) return (
    <section className="panel forge-empty">
      <div className="panel-head"><div><h2><Hammer size={17} /> Forgemagie</h2><p>Choisis un objet, saisis ton jet et l’objectif : l’atelier te dit quelle rune passer, et avec quelles chances.</p></div></div>
      <ForgeItemPicker catalog={catalog} onPick={pick} />
    </section>
  );

  const current = fmItemWeight(lines, values), perfect = fmPerfectWeight(lines);
  const toAdd = lines.reduce((sum, line) => sum + Math.max(0, fmValueWeight(line, targets[line.effectId] ?? 0) - fmValueWeight(line, values[line.effectId] ?? 0)), 0);
  const overWeight = lines.reduce((sum, line) => sum + Math.max(0, fmValueWeight(line, targets[line.effectId] ?? 0) - Math.max(0, fmValueWeight(line, line.max))), 0);
  const capped = lines.filter((line) => (targets[line.effectId] ?? 0) > fmLineCap(line));
  const hard = fmHardLines(lines, values, targets);
  const heavyExos = lines.filter((line) => line.exo && AP_MP_RANGE.includes(line.effectId) && (targets[line.effectId] ?? 0) > 0);
  const name = (line: FmLine) => catalog.stats.find((entry) => entry.key === line.stat)?.name || line.stat;
  return (
    <div className="forge-grid">
      <div className="forge-main">
        <section className="panel">
          <div className="panel-head">
            <div className="forge-item">
              <GameImage src={item.icon} />
              <div><h2>{item.name}</h2><p>Niv. {item.level} · {item.typeName}</p></div>
            </div>
            <button className="button small ghost" onClick={() => setSession(emptyForge())}>Changer d’objet</button>
          </div>
          <ForgeLines
            catalog={catalog}
            lines={lines}
            values={values}
            targets={targets}
            onValue={setValue}
            onTarget={setTarget}
            onAddExo={(effectId) => setSession((s) => ({ ...s, exos: [...s.exos, effectId], values: { ...s.values, [effectId]: 0 }, targets: { ...s.targets, [effectId]: 1 } }))}
            onRemoveExo={(effectId) => setSession((s) => ({ ...s, exos: s.exos.filter((id) => id !== effectId) }))}
          />
          <div className="forge-actions">
            <button className="button small ghost" onClick={() => setSession((s) => ({ ...s, targets: { ...s.targets, ...Object.fromEntries(lines.filter((line) => !line.exo).map((line) => [line.effectId, line.max])) } }))}>Objectif = jet parfait</button>
            <button className="button small ghost" onClick={() => setSession((s) => ({ ...s, values: { ...s.values, ...Object.fromEntries(lines.map((line) => [line.effectId, line.exo ? 0 : line.min])) } }))}>Actuel = jet minimum</button>
          </div>
          {capped.length > 0 && <p className="notice error">Au-delà du plafond de 101 de poids : {capped.map((line) => `${name(line)} (max ${fmt(fmLineCap(line))})`).join(", ")}.</p>}
          {heavyExos.length > 1 && <p className="notice error">Un seul exo PA, PM ou Portée par objet.</p>}
          {hard.map(({ line, rune, odds }) => (
            <p className="notice warning" key={line.effectId}>
              Fin difficile : {name(line)} ({fmt(values[line.effectId] ?? 0)} → {fmt(targets[line.effectId] ?? 0)}) ne se termine qu’avec une rune {rune.name}, qui passe à ~{fmt(odds.clean * 100)} % en succès critique. Baisse l’objectif ou attends-toi à beaucoup d’échecs.
            </p>
          ))}
        </section>
        <ForgeScreen onText={readScreen} onSharing={onSharing} />
      </div>
      <aside className="forge-side">
        <section className="panel forge-summary">
          <div className="panel-head"><div><h2><Scale size={17} /> Poids et puits</h2></div></div>
          <div className="stats-list">
            <div className="stat-line"><span /><span>Poids actuel</span><strong>{fmt(current)}</strong></div>
            <div className="stat-line"><span /><span>Poids au jet parfait</span><strong>{fmt(perfect)}</strong></div>
            <div className="stat-line"><span /><span>Remplissage</span><strong>{perfect > 0 ? `${fmt(current / perfect * 100)} %` : "—"}</strong></div>
            <div className="stat-line"><span /><span>Poids à ajouter</span><strong>{fmt(toAdd)}</strong></div>
            <div className="stat-line"><span /><span>Dont over et exo</span><strong>{fmt(overWeight)}</strong></div>
          </div>
          <label className="field forge-pool">Puits (reliquat) affiché en jeu
            <input type="number" min="0" step="0.1" value={pool} onChange={(event) => setSession((s) => ({ ...s, pool: Math.max(0, Number(event.target.value) || 0) }))} />
          </label>
        </section>
        <ForgeAdvice catalog={catalog} advice={advice} options={plan.options} running={plan.running} locked={sharing} onOutcome={outcome} />
        <section className="panel forge-calibration">
          <div className="panel-head"><div><h2><Gauge size={17} /> Calibrage</h2><p>Les probabilités s’ajustent sur les runes que tu passes réellement.</p></div></div>
          {calibration.count ? (
            <>
              <div className="stats-list">
                <div className="stat-line"><span /><span>Runes observées</span><strong>{calibration.count}</strong></div>
                <div className="stat-line"><span /><span>Succès critiques : vus / prévus par le modèle</span><strong>{fmt(calibration.observed.clean * 100)} % / {fmt(calibration.predicted.clean * 100)} %</strong></div>
                <div className="stat-line"><span /><span>Échecs critiques : vus / prévus par le modèle</span><strong>{fmt(calibration.observed.failure * 100)} % / {fmt(calibration.predicted.failure * 100)} %</strong></div>
                <div className="stat-line"><span /><span>Ajustement SC · EC</span><strong>×{fmt(calibration.cleanScale)} · ×{fmt(calibration.failureScale)}</strong></div>
              </div>
              <button className="button small ghost forge-calibration-reset" onClick={() => window.confirm("Oublier les runes observées ?") && setLog([])}>Réinitialiser</button>
            </>
          ) : <p className="inline-notice">Aucune rune observée : partage l’écran ou indique les résultats.</p>}
        </section>
        <p className="notice"><Info size={14} />Ankama ne publie pas les probabilités de forgemagie : elles suivent le modèle communautaire et restent des estimations. Les poids viennent du client du jeu.</p>
      </aside>
    </div>
  );
}
