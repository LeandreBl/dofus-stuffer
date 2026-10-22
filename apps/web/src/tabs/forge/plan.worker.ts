/// <reference lib="webworker" />
import { FM_MODEL, fmPlan, type FmLine, type FmPlanOption, type FmState, type FmValues } from "@dofus/shared";

export type PlanRequest = { id: number; lines: FmLine[]; state: FmState; targets: FmValues; cleanScale: number; failureScale: number };
export type PlanReply = { id: number; options: FmPlanOption[] };

self.onmessage = ({ data }: MessageEvent<PlanRequest>) => {
  Object.assign(FM_MODEL, { cleanScale: data.cleanScale, failureScale: data.failureScale });
  self.postMessage({ id: data.id, options: fmPlan(data.lines, data.state, data.targets) } satisfies PlanReply);
};
