const TOKEN_KEY = "dofus-admin-token";

export interface Overview {
  catalog: { version: string; revision?: string; items: number; spells: number; classes: number; servers: number };
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
