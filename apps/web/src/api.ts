import { io, type Socket } from "socket.io-client";
import type {
  Catalog,
  JobReceipt,
  JobSnapshot,
  OptimizationRequest,
  PriceBook,
} from "@dofus/shared";

export type AutomaticPrices = {
  server: string;
  values: PriceBook["values"];
  exoCosts: PriceBook["exoCosts"];
  updatedAt?: string;
  source?: string;
  configured: boolean;
  status: "available" | "unconfigured" | "unavailable";
  lastCheck?: MaintenanceCheck;
};
type MaintenanceCheck = {
  status: "updated" | "unchanged" | "older" | "error" | "unconfigured";
  checkedAt: string;
  message: string;
};
export type MaintenanceStatus = {
  running: boolean;
  startedAt?: string;
  completedAt?: string;
  catalogVersion?: string;
  catalogRevision?: string;
  catalog?: MaintenanceCheck;
  prices?: MaintenanceCheck;
  patch?: MaintenanceCheck;
  message?: string;
  latestPatch?: { title: string; url: string; publishedAt?: string; excerpt: string; version?: string };
};
export type PriceSyncState = {
  server: string;
  status: AutomaticPrices["status"] | "loading" | "error";
  configured?: boolean;
  lastCheck?: MaintenanceCheck;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(payload?.message)
        ? payload.message.join(" · ")
        : payload?.message || `Le serveur a répondu ${response.status}.`,
    );
  return payload as T;
}

export const api = {
  catalog: () => request<Catalog>("/catalog", { cache: "no-cache" }),
  prices: (server: string, signal?: AbortSignal) => request<AutomaticPrices>(`/prices?server=${encodeURIComponent(server)}`, { cache: "no-store", signal }),
  maintenance: (signal?: AbortSignal) => request<MaintenanceStatus>("/maintenance", { cache: "no-store", signal }),
  optimize: (body: OptimizationRequest) =>
    request<JobReceipt>("/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  job: ({ id, token }: JobReceipt) =>
    request<JobSnapshot>(
      `/jobs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } },
    ),
  cancel: ({ id, token }: JobReceipt) =>
    request<JobSnapshot>(`/jobs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }),
};

export function followJob(
  receipt: JobReceipt,
  onUpdate: (snapshot: JobSnapshot) => void,
  onConnection: (connected: boolean) => void,
): () => void {
  const socket: Socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  let closed = false;
  let terminal = false;
  let latestUpdate = "";
  const accept = (snapshot: JobSnapshot) => {
    if (closed || snapshot.id !== receipt.id) return;
    const nextTerminal = ["completed", "cancelled", "failed"].includes(
      snapshot.status,
    );
    if (snapshot.updatedAt < latestUpdate || (terminal && !nextTerminal))
      return;
    latestUpdate = snapshot.updatedAt;
    terminal = nextTerminal;
    onUpdate(snapshot);
  };
  socket.on("connect", () => {
    onConnection(true);
    socket.emit(
      "subscribe",
      { jobId: receipt.id, token: receipt.token },
      (acknowledgement: { ok?: boolean }) => {
        if (acknowledgement?.ok === false) onConnection(false);
      },
    );
  });
  socket.on("disconnect", () => onConnection(false));
  socket.on("connect_error", () => onConnection(false));
  socket.on("job:update", accept);
  // A snapshot also covers updates published before the subscription and WS reconnects.
  const refresh = () => {
    if (!terminal)
      api
        .job(receipt)
        .then(accept)
        .catch(() => onConnection(false));
  };
  refresh();
  const polling = window.setInterval(refresh, 3000);
  return () => {
    closed = true;
    window.clearInterval(polling);
    socket.disconnect();
  };
}
