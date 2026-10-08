import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Build, Catalog, JobReceipt, JobSnapshot, OptimizationRequest } from "@dofus/shared";
import { api, followJob } from "../lib/api";

/** Server-side search: start, cancel and follow a job; the best result is applied once when it ends. */
export function useOptimization({ catalog, initialReceipt, setBuild, setCatalogUpdated }: {
  catalog: Catalog;
  initialReceipt: JobReceipt | null;
  setBuild: Dispatch<SetStateAction<Build>>;
  setCatalogUpdated: Dispatch<SetStateAction<boolean>>;
}) {
  const [starting, setStarting] = useState(false);
  const [receipt, setReceipt] = useState<JobReceipt | null>(initialReceipt);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedResult, setSelectedResult] = useState(0);
  const appliedResult = useRef("");
  const active = !!job && ["queued", "running"].includes(job.status);

  useEffect(() => {
    if (!receipt) return;
    return followJob(
      receipt,
      (next) => {
        if (next.catalogVersion !== catalog.version || (next.catalogRevision && next.catalogRevision !== catalog.revision)) {
          setReceipt(null);
          setJob(null);
          setCatalogUpdated(true);
          return;
        }
        setJob((previous) =>
          previous && previous.id === next.id && previous.updatedAt > next.updatedAt ? previous : next,
        );
        if (
          next.results.length &&
          ["completed", "cancelled"].includes(next.status) &&
          appliedResult.current !== next.id
        ) {
          appliedResult.current = next.id;
          setBuild(next.results[0].build);
          setSelectedResult(0);
        }
      },
      setConnected,
      () => {
        // The job expired server-side; drop the stale receipt instead of polling it forever.
        setReceipt(null);
        setJob((previous) => (previous && !["completed", "cancelled", "failed"].includes(previous.status) ? null : previous));
      },
    );
  }, [receipt, catalog.version, catalog.revision, setBuild, setCatalogUpdated]);

  /** Starts a search; throws when the server refuses it. */
  async function start(request: OptimizationRequest) {
    setStarting(true);
    try {
      const result = await api.optimize(request);
      setCatalogUpdated(false);
      setReceipt(result);
      const now = new Date().toISOString();
      setJob({
        id: result.id,
        status: result.status,
        createdAt: now,
        updatedAt: now,
        progress: { percent: 0, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null },
        results: [],
        catalogVersion: catalog.version,
        catalogRevision: catalog.revision,
      });
    } finally {
      setStarting(false);
    }
  }

  const cancel = async () => {
    if (receipt) await api.cancel(receipt);
  };

  return { starting, receipt, job, active, connected, selectedResult, setSelectedResult, start, cancel };
}
