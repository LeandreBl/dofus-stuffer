const TOKEN_KEY = "dofus-admin-token";

export type JobStatus = "queued" | "running" | "completed" | "cancelled" | "failed" | "unknown";
export interface DayStats { day: string; created: number; completed: number; cancelled: number; failed: number; computeMs: number; evaluated: number }
export interface CheckReport { status: string; checkedAt: string; message: string; source?: string; sourceVersion?: string }
export interface Overview {
  redis: boolean;
  workers: number;
  paused: boolean;
  counts: Record<"active" | "waiting" | "prioritized" | "delayed" | "paused" | "completed" | "failed", number>;
  stats: DayStats[];
  catalog: { version: string; revision?: string; items: number; spells: number; classes: number; servers: number };
  maintenance: {
    running: boolean; cron: string; timezone: string; startedAt?: string; completedAt?: string; message?: string;
    catalog?: CheckReport; prices?: CheckReport; patch?: CheckReport;
    latestPatch?: { title: string; url: string; publishedAt?: string; version?: string };
  };
}
export interface AdminJob {
  id: string; status: JobStatus; createdAt: string; startedAt?: number; finishedAt?: number;
  className: string; level?: number; seconds?: number; constraints: number; results: number; message?: string;
  progress?: { percent: number; evaluated: number; feasible: number; elapsedMs: number };
}

export class AuthError extends Error {}

export const getToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};
export const setToken = (token: string) => {
  try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* blocked storage: lives in memory only */ }
};

export async function api<T>(path: string, method: "GET" | "POST" = "GET", token = getToken()): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 || response.status === 404) throw new AuthError("Jeton invalide ou admin désactivé (ADMIN_TOKEN).");
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Erreur HTTP ${response.status}`);
  return body as T;
}
