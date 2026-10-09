/// <reference lib="webworker" />
import type { Build, BuildEvaluation, Catalog, OptimizationRequest } from "@dofus/shared";
import { createSearch, type Search } from "@dofus/shared/search";

/** One search island: its own annealing walk, steered by the main thread between rounds. */
export type IslandMessage =
  | { type: "catalog"; catalog: Catalog }
  | { type: "start"; request: OptimizationRequest; seed: number }
  | { type: "run"; ms: number; progress: number; adopt?: Build };
export type IslandReport =
  | { evaluated: number; feasible: number; results: BuildEvaluation[]; best: Build | null; fitness: number; canMutate: boolean; error?: undefined }
  | { error: string };

let catalog: Catalog | null = null;
let search: Search | null = null;

self.onmessage = ({ data }: MessageEvent<IslandMessage>) => {
  try {
    if (data.type === "catalog") { catalog = data.catalog; return; }
    if (data.type === "start") search = createSearch(catalog!, data.request, data.seed);
    else if (search) {
      if (data.adopt) search.adopt(data.adopt);
      const end = performance.now() + data.ms;
      do search.run(500, data.progress); while (search.canMutate && performance.now() < end);
    }
    const { evaluated, feasible, results } = search!.snapshot();
    self.postMessage({ evaluated, feasible, results, best: search!.best(), fitness: search!.bestFitness(), canMutate: search!.canMutate } satisfies IslandReport);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies IslandReport);
  }
};
