import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Build, Catalog, JobReceipt, JobSnapshot, OptimizationRequest, QueueStatus } from "@dofus/shared";
import { api, followJob } from "../lib/api";

/** Server-side search: start, cancel and follow a job; the selected result is applied live while it runs. */
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
  // Read from the job callback, which is not re-subscribed when the selection changes.
  const selectedRef = useRef(selectedResult);
  selectedRef.current = selectedResult;
  const active = !!job && ["queued", "running"].includes(job.status);
  // How the last search seen running ended; cleared when a new one starts.
  const [finished, setFinished] = useState<JobSnapshot["status"] | null>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setFinished(null);
    } else if (wasActive.current) {
      wasActive.current = false;
      setFinished(job?.status ?? null);
    }
  }, [active, job?.status]);

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
        const running = ["queued", "running"].includes(next.status);
        if (next.results.length && (running || appliedResult.current !== next.id)) {
          if (!running) appliedResult.current = next.id;
          const index = Math.min(selectedRef.current, next.results.length - 1);
          const live = next.results[index].build;
          setBuild((previous) => (JSON.stringify(previous) === JSON.stringify(live) ? previous : live));
          setSelectedResult(index);
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

  // Queue position is not pushed: poll it only while the job waits for a worker.
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const queued = job?.status === "queued" && receipt?.id === job.id;
  useEffect(() => {
    setQueue(null);
    if (!queued || !receipt) return;
    let live = true;
    const refresh = () => api.queue(receipt).then((next) => live && setQueue(next)).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { live = false; window.clearInterval(timer); };
  }, [queued, receipt]);

  /** Starts a search; throws when the server refuses it. */
  async function start(request: OptimizationRequest) {
    setStarting(true);
    try {
      const result = await api.optimize(request);
      setCatalogUpdated(false);
      setReceipt(result);
      setSelectedResult(0);
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

  return { starting, receipt, job, queue, active, finished, dismissFinished: () => setFinished(null), connected, selectedResult, setSelectedResult, start, cancel };
}
