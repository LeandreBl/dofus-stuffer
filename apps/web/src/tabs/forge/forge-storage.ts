import type { FmObservation, FmValues } from "@dofus/shared";

export interface ForgeSession {
  itemId?: number;
  values: FmValues;
  targets: FmValues;
  /** Weight left in the item's pool (reliquat), as shown in game. */
  pool: number;
  /** Effect ids added as exo lines. */
  exos: number[];
}

const FORGE_KEY = "dofus-stuffer.forge.v1";
export const emptyForge = (): ForgeSession => ({ values: {}, targets: {}, pool: 0, exos: [] });
export function loadForge(): ForgeSession {
  try {
    const state = JSON.parse(localStorage.getItem(FORGE_KEY) || "null");
    if (state && typeof state.pool === "number" && state.values && state.targets && Array.isArray(state.exos)) return state;
  } catch { /* Unavailable storage or an old malformed session starts cleanly. */ }
  return emptyForge();
}
export function saveForge(state: ForgeSession) {
  try { localStorage.setItem(FORGE_KEY, JSON.stringify(state)); } catch { /* The forge also works without persistent storage. */ }
}

const LOG_KEY = "dofus-stuffer.forge-log.v1";
/** Real outcomes kept for calibration, across items; the oldest go first. */
const LOG_SIZE = 2000;
export function loadForgeLog(): FmObservation[] {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    if (Array.isArray(log)) return log;
  } catch { /* Unavailable storage or a malformed log starts cleanly. */ }
  return [];
}
export function saveForgeLog(log: FmObservation[]) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_SIZE))); } catch { /* Calibration also works for this visit only. */ }
}
