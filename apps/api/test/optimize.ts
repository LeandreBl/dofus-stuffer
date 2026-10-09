import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import type { BuildEvaluation, Catalog, JobProgress, OptimizationRequest } from '@dofus/shared';
import { createSearch, SearchConfigurationError } from '@dofus/shared/search';

export { SearchConfigurationError };
export interface SearchUpdate { progress: JobProgress; results: BuildEvaluation[]; }
export interface SearchResult extends SearchUpdate { cancelled: boolean; stopReason: 'time' | 'fixed' | 'cancelled'; }
export interface SearchHooks {
  /** Called at most three times a second; returning true cancels the search. */
  onProgress: (update: SearchUpdate) => Promise<boolean>;
}

const CHUNK = 2_000;

/** Test driver: runs the shared search engine for `request.seconds`, like one browser island. */
export async function optimize(catalog: Catalog, request: OptimizationRequest, hooks: SearchHooks): Promise<SearchResult> {
  const started = Date.now();
  const total = request.seconds * 1_000;
  const search = createSearch(catalog, request, request.seed ?? Math.floor(Math.random() * 4_294_967_296));

  const update = (): SearchUpdate => {
    const { evaluated, feasible, results } = search.snapshot();
    return { progress: { percent: Math.min(99, Math.floor((Date.now() - started) / (request.seconds * 10))),
      evaluated, feasible, elapsedMs: Date.now() - started, bestScore: results[0]?.score ?? null }, results };
  };

  let cancelled = false;
  let lastReport = 0;
  while (search.canMutate && Date.now() - started < total) {
    search.run(CHUNK, (Date.now() - started) / total);
    await yieldToEventLoop();
    if (Date.now() - lastReport >= 350) {
      lastReport = Date.now();
      cancelled = await hooks.onProgress(update());
      if (cancelled) break;
    }
  }
  if (!cancelled) cancelled = await hooks.onProgress(update());
  const final = update();
  final.progress.percent = cancelled ? final.progress.percent : 100;
  return { ...final, cancelled,
    stopReason: cancelled ? 'cancelled' : !search.canMutate ? 'fixed' : 'time' };
}
