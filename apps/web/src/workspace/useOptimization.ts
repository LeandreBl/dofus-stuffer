import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Build, BuildEvaluation, Catalog, JobSnapshot, OptimizationRequest } from "@dofus/shared";
import type { IslandMessage, IslandReport } from "./search.worker";

// ponytail: each island holds its own catalog copy (~25 MB); share an ArrayBuffer dataset if memory becomes a problem.
const ISLANDS = Math.max(1, Math.min(4, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2) - 1));
const ROUND_MS = 250;
const MIGRATE_EVERY = 4;
const MAX_RESULTS = 5;

type Island = { worker: Worker; catalog: Catalog | null };
function call(island: Island, message: IslandMessage): Promise<IslandReport> {
  return new Promise((resolve) => {
    island.worker.onmessage = ({ data }: MessageEvent<IslandReport>) => resolve(data);
    island.worker.onerror = (event) => resolve({ error: event.message || "Le moteur de recherche s’est arrêté." });
    island.worker.postMessage(message);
  });
}

/** Results of every island: one per gear set (Dofus variants aside), best score first. */
function merge(lists: BuildEvaluation[][]): BuildEvaluation[] {
  const byGear = new Map<string, BuildEvaluation>();
  for (const result of lists.flat()) {
    const { slots, exoBonuses } = result.build;
    const gear = `${Object.entries(slots).filter(([slot]) => !slot.startsWith("dofus")).map(([, id]) => id).sort().join(".")}|${[...(exoBonuses || [])].sort().join(".")}`;
    const previous = byGear.get(gear);
    if (!previous || result.score > previous.score) byGear.set(gear, result);
  }
  return [...byGear.values()].sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

/** Browser-side search: annealing islands in Web Workers; the selected result is applied live while it runs. */
export function useOptimization({ catalog, setBuild }: {
  catalog: Catalog;
  setBuild: Dispatch<SetStateAction<Build>>;
}) {
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [selectedResult, setSelectedResult] = useState(0);
  const [finished, setFinished] = useState<JobSnapshot["status"] | null>(null);
  const selectedRef = useRef(selectedResult);
  selectedRef.current = selectedResult;
  const islands = useRef<Island[]>([]);
  const cancelled = useRef(false);
  const active = !!job && job.status === "running";

  useEffect(() => () => islands.current.forEach((island) => island.worker.terminate()), []);

  const apply = (results: BuildEvaluation[]) => {
    if (!results.length) return;
    const index = Math.min(selectedRef.current, results.length - 1);
    const live = results[index].build;
    setBuild((previous) => (JSON.stringify(previous) === JSON.stringify(live) ? previous : live));
    setSelectedResult(index);
  };

  /** Starts a search; throws when the request cannot be searched. */
  async function start(request: OptimizationRequest) {
    setStarting(true);
    let pool: Island[];
    try {
      while (islands.current.length < ISLANDS) {
        islands.current.push({ worker: new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" }), catalog: null });
      }
      pool = islands.current;
      for (const island of pool) if (island.catalog !== catalog) { island.worker.postMessage({ type: "catalog", catalog } satisfies IslandMessage); island.catalog = catalog; }
      const ready = await Promise.all(pool.map((island) => call(island, { type: "start", request, seed: Math.floor(Math.random() * 4_294_967_296) })));
      const failure = ready.find((report) => report.error);
      if (failure?.error) throw new Error(failure.error);
    } finally {
      setStarting(false);
    }
    cancelled.current = false;
    setFinished(null);
    setSelectedResult(0);
    const now = new Date().toISOString();
    const snapshot: JobSnapshot = {
      id: crypto.randomUUID(), status: "running", createdAt: now, updatedAt: now,
      progress: { percent: 0, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null },
      results: [], catalogVersion: catalog.version, catalogRevision: catalog.revision,
    };
    setJob(snapshot);
    void run(pool, request, snapshot);
  }

  async function run(pool: Island[], request: OptimizationRequest, snapshot: JobSnapshot) {
    const started = performance.now();
    const total = request.seconds * 1_000;
    let adopt: Build | undefined;
    let status: JobSnapshot["status"] = "completed";
    let error: string | undefined;
    for (let round = 0; ; round += 1) {
      const elapsed = performance.now() - started;
      if (cancelled.current) { status = "cancelled"; break; }
      if (elapsed >= total) break;
      const reports = await Promise.all(pool.map((island) => call(island, { type: "run", ms: Math.min(ROUND_MS, total - elapsed), progress: elapsed / total, adopt })));
      const live = reports.filter((report): report is Exclude<IslandReport, { error: string }> => !report.error);
      if (!live.length) { status = "failed"; error = reports[0].error; break; }
      // Migration: every few rounds, all islands may restart from the best island's build.
      adopt = (round + 1) % MIGRATE_EVERY === 0 ? live.reduce((best, report) => (report.fitness > best.fitness ? report : best)).best ?? undefined : undefined;
      const elapsedMs = Math.round(performance.now() - started);
      Object.assign(snapshot, {
        updatedAt: new Date().toISOString(),
        results: merge(live.map((report) => report.results)),
        progress: {
          percent: Math.min(99, Math.floor((100 * elapsedMs) / total)), elapsedMs,
          evaluated: live.reduce((sum, report) => sum + report.evaluated, 0),
          feasible: live.reduce((sum, report) => sum + report.feasible, 0),
          bestScore: null,
          rounds: round + 1, islands: live.length,
        },
      });
      snapshot.progress.bestScore = snapshot.results[0]?.score ?? null;
      setJob({ ...snapshot });
      apply(snapshot.results);
      if (live.every((report) => !report.canMutate)) break;
    }
    const done = { ...snapshot, status, error, updatedAt: new Date().toISOString(), progress: { ...snapshot.progress, percent: status === "completed" ? 100 : snapshot.progress.percent } };
    setJob(done);
    setFinished(status);
    apply(done.results);
  }

  const cancel = async () => { cancelled.current = true; };

  return { starting, job, active, finished, dismissFinished: () => setFinished(null), selectedResult, setSelectedResult, start, cancel };
}
