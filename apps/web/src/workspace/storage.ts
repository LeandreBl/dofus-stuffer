import {
  defaultCharacter,
  defaultTarget,
  SLOTS,
  slotType,
  type Build,
  type Catalog,
  type Constraint,
  type OptimizationRequest,
  type PriceBook,
  type Slot,
} from "@dofus/shared";
import { classSlug } from "../lib/class-slug";
import { withoutCreatureTarget } from "../lib/spell-scenario";

export const STORAGE_KEY = "dofus-stuffer.workspace.v2";
export type SavedState = {
  version: number;
  catalogVersion: string;
  catalogRevision?: string;
  catalogUpdated: boolean;
  exosUpdated: boolean;
  request: OptimizationRequest;
  build: Build;
  priceBooks: Record<string, PriceBook>;
};

export function initialState(catalog: Catalog): SavedState {
  // Class pages (/class/iop/) open a fresh workspace on their class; saved workspaces keep theirs.
  const pageClass = location.pathname.split("/")[2];
  const character = defaultCharacter(
    catalog.classes.find((gameClass) => classSlug(gameClass.name) === pageClass)?.id ||
      catalog.classes.find((gameClass) => gameClass.name === "Crâ")?.id || 9,
    200,
  );
  const request: OptimizationRequest = {
    character,
    target: defaultTarget(),
    seconds: 15,
    constraints: [],
    filters: {
      excludedItemIds: [],
      excludedTypeIds: [],
      excludedCategories: [],
      lockedSlots: {},
      allowedExos: ["actionPoints", "movementPoints"],
      maxExos: 0,
    },
    prices: {
      server: catalog.servers[0] || "Mon serveur",
      values: {},
      ownedItemIds: [],
      mode: "total",
    },
  };
  const fallback = {
    version: 4,
    catalogVersion: catalog.version,
    catalogRevision: catalog.revision,
    catalogUpdated: false,
    exosUpdated: false,
    request,
    build: { slots: {} },
    priceBooks: {},
  };
  let stored: unknown;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { /* A corrupted save starts a fresh workspace. */ }
  return restoreState(catalog, stored, fallback) ?? fallback;
}

/** Validates and migrates a saved profile; null when it is not one. */
function restoreState(catalog: Catalog, stored: any, fallback: SavedState): SavedState | null {
  try {
    if (
      ![2, 3, 4].includes(stored?.version) ||
      !stored.request ||
      !Array.isArray(stored.request.constraints) ||
      !stored.request.character?.baseStats ||
      !stored.request.filters?.lockedSlots ||
      !Array.isArray(stored.request.filters?.excludedItemIds) ||
      !Array.isArray(stored.request.filters?.excludedTypeIds) ||
      !Array.isArray(stored.request.filters?.excludedCategories) ||
      !stored.request.target?.percent ||
      !stored.request.target?.flat ||
      !stored.request.prices?.values ||
      !stored.build?.slots
    )
      return null;
    const exosUpdated = stored.version < 4;
    if (exosUpdated) {
      try { localStorage.setItem(`${STORAGE_KEY}.before-global-exos`, JSON.stringify(stored)); } catch { /* The current profile can still be migrated when storage is full. */ }
    }
    const validItems = new Map(catalog.items.map((item) => [item.id, item]));
    stored.build.slots = validSlots(catalog, stored.build.slots);
    stored.request.filters.lockedSlots = validSlots(catalog, stored.request.filters.lockedSlots);
    stored.request.constraints = stored.request.constraints.filter(
      (criterion: Constraint) =>
        Number.isFinite(criterion.target) &&
        Number.isInteger(criterion.priority) &&
        (criterion.kind === "price" || criterion.kind === "weapon" ||
          (criterion.kind === "stat" &&
            catalog.stats.some((stat) => stat.key === criterion.statKey)) ||
          (criterion.kind === "spell" &&
            catalog.spells.some((spell) => spell.id === criterion.spellId))),
    ).map((criterion: Constraint) => criterion.scenario ? { ...criterion, scenario: withoutCreatureTarget(criterion.scenario) } : criterion);
    if (!stored.request.character.allocationMode) {
      stored.request.character.allocationMode = "automatic";
      stored.build.baseStats ??= { ...stored.request.character.baseStats };
    }
    const catalogUpdated = stored.catalogVersion !== catalog.version || (!!stored.catalogRevision && stored.catalogRevision !== catalog.revision);
    if (catalogUpdated) {
      try { localStorage.setItem(`${STORAGE_KEY}.before-catalog-update`, JSON.stringify(stored)); } catch { /* Keep using the profile even when backup storage is unavailable. */ }
    }
    stored.request.filters.excludedItemIds = stored.request.filters.excludedItemIds.filter((id: number) => validItems.has(id));
    if (Array.isArray(stored.request.filters.allowedItemIds)) stored.request.filters.allowedItemIds = stored.request.filters.allowedItemIds.filter((id: number) => validItems.has(id));
    stored.request.character.scrollStats ??= {};
    stored.request.seconds = Number.isInteger(stored.request.seconds)
      ? Math.max(3, Math.min(600, stored.request.seconds))
      : fallback.request.seconds;
    stored.request.filters.allowedExos ??= [];
    stored.build.exoBonuses = [...new Set([...(stored.build.exoBonuses || []), ...Object.values(stored.build.exos || {})].filter((exo) => exo === "actionPoints" || exo === "movementPoints"))];
    if (exosUpdated) stored.request.filters.allowedExos = [...new Set([...stored.request.filters.allowedExos, ...stored.build.exoBonuses])];
    if (!Number.isInteger(stored.request.filters.maxExos) || stored.request.filters.maxExos < 0 || stored.request.filters.maxExos > 2) {
      const allowedExos = [...new Set(stored.request.filters.allowedExos.filter((exo: string) => exo === "actionPoints" || exo === "movementPoints"))];
      stored.request.filters.maxExos = allowedExos.length;
      stored.request.filters.allowedExos = allowedExos.length ? allowedExos : ["actionPoints", "movementPoints"];
    }
    delete stored.build.exos;
    delete stored.request.filters.lockedExos;
    delete stored.request.initialBuild;
    // Server-side search receipts from before browser search.
    delete stored.receipt;
    const migratePrices = (book: Record<string, unknown>) => {
      delete book.exoValues;
      delete book.ownedExoKeys;
      const currentPrices = (values: unknown) => values && typeof values === "object" && !Array.isArray(values)
        ? Object.fromEntries(Object.entries(values).filter(([id]) => validItems.has(Number(id))))
        : {};
      book.values = currentPrices(book.values);
      if (book.automaticValues !== undefined) book.automaticValues = currentPrices(book.automaticValues);
      book.mode = "total";
      book.ownedItemIds = [];
      delete book.ownedExos;
      return book;
    };
    migratePrices(stored.request.prices);
    stored.priceBooks = Object.fromEntries(Object.entries(stored.priceBooks || {}).filter(([, book]) => book && typeof book === "object" && !Array.isArray(book)).map(([server, book]) => [server, migratePrices(book as Record<string, unknown>)]));
    return { ...fallback, ...stored, version: 4, catalogVersion: catalog.version, catalogRevision: catalog.revision, catalogUpdated, exosUpdated };
  } catch {
    return null;
  }
}

/** Keeps the slot entries whose item exists in this catalog and fits the slot. */
export function validSlots(catalog: Catalog, slots: unknown): Partial<Record<Slot, number>> {
  if (!slots || typeof slots !== "object") return {};
  return Object.fromEntries(Object.entries(slots).filter(([slot, id]) => {
    const entry = typeof id === "number" ? catalog.items.find((item) => item.id === id) : undefined;
    return SLOTS.includes(slot as Slot) && !!entry && entry.slotType === slotType(slot as Slot);
  }));
}

/** Saves the workspace in this browser; false when storage is unavailable or full. */
export function saveWorkspace(catalog: Catalog, state: Pick<SavedState, "request" | "build" | "priceBooks">): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 4, catalogVersion: catalog.version, catalogRevision: catalog.revision, ...state }),
    );
    return true;
  } catch {
    return false;
  }
}
