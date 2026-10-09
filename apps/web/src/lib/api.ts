import type { Catalog } from "@dofus/shared";

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
};
