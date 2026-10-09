import type { Catalog, PriceBook } from "@dofus/shared";

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
    throw Object.assign(new Error(
      Array.isArray(payload?.message)
        ? payload.message.join(" · ")
        : payload?.message || `Le serveur a répondu ${response.status}.`,
    ), { status: response.status });
  return payload as T;
}

export const api = {
  catalog: () => request<Catalog>("/catalog", { cache: "no-cache" }),
  prices: (server: string, signal?: AbortSignal) => request<AutomaticPrices>(`/prices?server=${encodeURIComponent(server)}`, { cache: "no-store", signal }),
  maintenance: (signal?: AbortSignal) => request<MaintenanceStatus>("/maintenance", { cache: "no-store", signal }),
};
