import { defaultCombatPreview, type CombatPreviewState } from "@dofus/shared";

const PREVIEW_KEY = "dofus-stuffer.combat-preview.v1";
export function loadCombatPreview(): CombatPreviewState {
  try {
    const state = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null");
    if (state && typeof state.turn === "number" && state.passives && typeof state.passives === "object"
      && !Array.isArray(state.passives) && state.boosts && typeof state.boosts === "object" && !Array.isArray(state.boosts)) return state;
  } catch { /* Unavailable storage or an old malformed preview starts cleanly. */ }
  return defaultCombatPreview();
}
export function saveCombatPreview(state: CombatPreviewState) {
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(state)); } catch { /* The preview also works without persistent storage. */ }
}
