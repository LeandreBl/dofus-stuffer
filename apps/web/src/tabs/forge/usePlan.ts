import { useEffect, useRef, useState } from "react";
import { FM_MODEL, type FmLine, type FmPlanOption, type FmValues } from "@dofus/shared";
import type { PlanReply, PlanRequest } from "./plan.worker";

/** Rollout plan of the next rune, computed off the main thread; stale answers are dropped. */
export function usePlan(lines: FmLine[], values: FmValues, pool: number, targets: FmValues) {
  const worker = useRef<Worker>(undefined);
  const latest = useRef(0);
  const [plan, setPlan] = useState<{ id: number; options: FmPlanOption[] }>();
  const [requested, setRequested] = useState(0);
  useEffect(() => {
    const created = new Worker(new URL("./plan.worker.ts", import.meta.url), { type: "module" });
    created.onmessage = ({ data }: MessageEvent<PlanReply>) => { if (data.id === latest.current) setPlan(data); };
    worker.current = created;
    return () => created.terminate();
  }, []);
  useEffect(() => {
    const id = ++latest.current;
    setRequested(id);
    const { cleanScale, failureScale } = FM_MODEL;
    const timer = window.setTimeout(() => worker.current?.postMessage({ id, lines, state: { values, pool }, targets, cleanScale, failureScale } satisfies PlanRequest), 250);
    return () => window.clearTimeout(timer);
  }, [lines, values, pool, targets, FM_MODEL.cleanScale, FM_MODEL.failureScale]);
  return { options: plan?.id === requested ? plan.options : undefined, running: plan?.id !== requested };
}
