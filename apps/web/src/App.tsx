import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Coins,
  Download,
  FlaskConical,
  Info,
  Layers3,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Swords,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  defaultCharacter,
  defaultTarget,
  evaluateBuild,
  getCharacterAllocation,
  SLOTS,
  slotType,
  type Build,
  type Catalog,
  type Constraint,
  type EquipmentItem,
  type JobReceipt,
  type JobSnapshot,
  type OptimizationRequest,
  type PriceBook,
  type Slot,
} from "@dofus/shared";
import { api, followJob, type MaintenanceStatus, type PriceSyncState } from "./api";
import { manualBuildRequest } from "./build-preview";
import { withEquipmentLocks } from "./equipment-locks";
import { withoutCreatureTarget } from "./spell-scenario";
import { CharacterEditor } from "./CharacterEditor";
import { ConstraintEditor, CriteriaCatalog, Priorities } from "./Constraints";
import {
  BuildView,
  chooseSlot,
  EquipmentFilters,
  ItemBrowser,
  ItemDetail,
} from "./Equipment";
import { downloadJson, Market } from "./Market";
import { SpellView } from "./Spells";
import { fmt, GameImage, Modal, money, StatIcon } from "./ui";

const STORAGE_KEY = "dofus-stuffer.workspace.v2";
type Tab = "builder" | "equipment" | "spells" | "market";
type SavedState = {
  version: number;
  catalogVersion: string;
  catalogRevision?: string;
  catalogUpdated: boolean;
  exosUpdated: boolean;
  request: OptimizationRequest;
  build: Build;
  priceBooks: Record<string, PriceBook>;
  receipt: JobReceipt | null;
};
const tabs = [
  { id: "builder", label: "Mon atelier", Icon: SlidersHorizontal },
  { id: "equipment", label: "Mon stuff", Icon: Layers3 },
  { id: "spells", label: "Mes dégâts", Icon: Swords },
  { id: "market", label: "Marché", Icon: Coins },
] as const;

function initialState(catalog: Catalog): SavedState {
  const character = defaultCharacter(
    catalog.classes.find((gameClass) => gameClass.name === "Crâ")?.id || 9,
    200,
  );
  const request: OptimizationRequest = {
    character,
    target: defaultTarget(),
    seconds: 15,
    constraints: [
      {
        id: "default-pa",
        kind: "stat",
        statKey: "actionPoints",
        target: 12,
        relation: "atLeast",
        priority: 0,
        strict: false,
      },
      {
        id: "default-pm",
        kind: "stat",
        statKey: "movementPoints",
        target: 6,
        relation: "atLeast",
        priority: 0,
        strict: false,
      },
      {
        id: "default-force",
        kind: "stat",
        statKey: "strength",
        target: 800,
        relation: "atLeast",
        priority: 1,
        strict: false,
      },
    ],
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
    receipt: null,
  };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
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
      return fallback;
    const exosUpdated = stored.version < 4;
    if (exosUpdated) {
      try { localStorage.setItem(`${STORAGE_KEY}.before-global-exos`, JSON.stringify(stored)); } catch { /* The current profile can still be migrated when storage is full. */ }
      stored.receipt = null;
    }
    const validItems = new Map(catalog.items.map((item) => [item.id, item]));
    const validSlotEntry = ([slot, id]: [string, unknown]) => {
      const entry = typeof id === "number" ? validItems.get(id) : undefined;
      return SLOTS.includes(slot as Slot) && !!entry && entry.slotType === slotType(slot as Slot);
    };
    stored.build.slots = Object.fromEntries(
      Object.entries(stored.build.slots).filter(validSlotEntry),
    );
    stored.request.filters.lockedSlots = Object.fromEntries(Object.entries(stored.request.filters.lockedSlots).filter(validSlotEntry));
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
      stored.receipt = null;
    }
    const catalogUpdated = stored.catalogVersion !== catalog.version || (!!stored.catalogRevision && stored.catalogRevision !== catalog.revision);
    if (catalogUpdated) {
      try { localStorage.setItem(`${STORAGE_KEY}.before-catalog-update`, JSON.stringify(stored)); } catch { /* Keep using the profile even when backup storage is unavailable. */ }
      stored.receipt = null;
    }
    stored.request.filters.excludedItemIds = stored.request.filters.excludedItemIds.filter((id: number) => validItems.has(id));
    if (Array.isArray(stored.request.filters.allowedItemIds)) stored.request.filters.allowedItemIds = stored.request.filters.allowedItemIds.filter((id: number) => validItems.has(id));
    stored.request.character.scrollStats ??= {};
    stored.request.seconds = Number.isInteger(stored.request.seconds)
      ? Math.max(3, Math.min(600, stored.request.seconds))
      : request.seconds;
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
    if (stored.request.prices.mode === "remaining") stored.receipt = null;
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
    return fallback;
  }
}

function Workspace({ catalog }: { catalog: Catalog }) {
  const [initial] = useState(() => initialState(catalog));
  const [request, setRequest] = useState(initial.request);
  const [build, setBuild] = useState<Build>(initial.build);
  const [catalogUpdated, setCatalogUpdated] = useState(initial.catalogUpdated);
  const [exosUpdated, setExosUpdated] = useState(initial.exosUpdated);
  const [priceBooks, setPriceBooks] = useState<Record<string, PriceBook>>(
    initial.priceBooks,
  );
  const [priceSync, setPriceSync] = useState<PriceSyncState>({ server: initial.request.prices.server, status: "loading" });
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const [tab, setTab] = useState<Tab>("builder");
  const [saved, setSaved] = useState(true);
  const [editing, setEditing] = useState<Constraint | null>(null);
  const [browser, setBrowser] = useState<{ slot?: Slot } | null>(null);
  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [itemSlot, setItemSlot] = useState<Slot | undefined>();
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [receipt, setReceipt] = useState<JobReceipt | null>(initial.receipt);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedResult, setSelectedResult] = useState(0);
  const appliedResult = useRef("");
  const evaluation = useMemo(
    () => evaluateBuild(catalog, manualBuildRequest(request), build),
    [catalog, request, build],
  );
  const activeJob = job && ["queued", "running"].includes(job.status);
  const characterAllocation = getCharacterAllocation({ ...request.character, baseStats: request.character.allocationMode === "manual" ? request.character.baseStats : {} });
  const currentClass = catalog.classes.find(
    (gameClass) => gameClass.id === request.character.classId,
  );
  const equippedItemSlot = !item ? undefined : itemSlot
    ? (build.slots[itemSlot] === item.id ? itemSlot : undefined)
    : (Object.keys(build.slots) as Slot[]).find((slot) => build.slots[slot] === item.id);
  const notify = useCallback((message: string) => setToast(message), []);
  const closeEditor = useCallback(() => setEditing(null), []);
  const closeBrowser = useCallback(() => setBrowser(null), []);
  const closeItem = useCallback(() => setItem(null), []);
  const closeHelp = useCallback(() => setHelp(false), []);

  useEffect(() => {
    const server = request.prices.server;
    const controller = new AbortController();
    const knownIds = new Set(catalog.items.map((item) => String(item.id)));
    let active = true;
    let pending = false;
    setPriceSync({ server, status: "loading" });
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const feed = await api.prices(server, controller.signal);
        if (!active || feed.server !== server) return;
        setPriceSync({ server, status: feed.status, configured: feed.configured, lastCheck: feed.lastCheck });
        if (feed.status !== "available") return;
        const validPrice = (price: unknown): price is number => typeof price === "number" && Number.isFinite(price) && price >= 0 && price <= 1_000_000_000_000;
        const automaticValues = Object.fromEntries(Object.entries(feed.values).filter(([id, price]) => knownIds.has(id) && validPrice(price)));
        const automaticExoCosts = Object.fromEntries(Object.entries(feed.exoCosts || {}).filter(([key, price]) => ["actionPoints", "movementPoints"].includes(key) && validPrice(price)));
        setRequest((previous) => previous.prices.server !== server ? previous : ({
          ...previous,
          prices: { ...previous.prices, automaticValues, automaticExoCosts, automaticUpdatedAt: feed.updatedAt, automaticSource: feed.source },
        }));
      } catch {
        if (active) setPriceSync({ server, status: "error" });
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [request.prices.server, catalog.items]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const refresh = () => api.maintenance(controller.signal).then((status) => {
      if (active) setMaintenance(status);
    }).catch(() => { /* Keep the previous successful maintenance report. */ });
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 4, catalogVersion: catalog.version, catalogRevision: catalog.revision, request, build, priceBooks, receipt }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [request, build, priceBooks, receipt, catalog.version, catalog.revision]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
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
          previous &&
          previous.id === next.id &&
          previous.updatedAt > next.updatedAt
            ? previous
            : next,
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
  }, [receipt, catalog.version, catalog.revision]);

  const addCriterion = (criterion: Constraint) =>
    setEditing({
      ...criterion,
      priority: request.constraints.length
        ? Math.max(...request.constraints.map((value) => value.priority)) + 1
        : 0,
    });
  const saveCriterion = (criteria: Constraint[], replacedIds: string[]) => {
    const replaced = new Set(replacedIds);
    if (request.constraints.filter((entry) => !replaced.has(entry.id)).length + criteria.length > 40) {
      notify("Tu peux définir jusqu’à 40 critères. Retire un critère pour ajouter ces objectifs.");
      return;
    }
    setRequest((value) => ({
      ...value,
      constraints: [
        ...value.constraints.flatMap((entry) => {
          if (!replaced.has(entry.id)) return [entry];
          const updated = criteria.find((candidate) => candidate.id === entry.id);
          return updated ? [updated] : [];
        }),
        ...criteria.filter((entry) => !value.constraints.some((existing) => existing.id === entry.id)),
      ],
    }));
    setEditing(null);
    notify(criteria.length > 1 ? "Les deux objectifs sont enregistrés dans tes priorités." : "Critère enregistré dans tes priorités.");
  };
  function changeServer(server: string) {
    setPriceBooks((previous) => ({
      ...previous,
      [request.prices.server]: request.prices,
    }));
    setRequest((previous) => ({
      ...previous,
      prices: priceBooks[server] || {
        server,
        values: {},
        ownedItemIds: [],
        mode: "total",
      },
    }));
  }
  function equip(selected: EquipmentItem, requestedSlot?: Slot) {
    const slot = requestedSlot || chooseSlot(selected, build);
    if (selected.slotType === "ring" && selected.setId && Object.entries(build.slots).some(([otherSlot, id]) => otherSlot !== slot && id === selected.id)) {
      notify("Cet anneau de panoplie est déjà équipé. Choisis un autre anneau.");
      return;
    }
    if (selected.slotType === "dofus" && Object.entries(build.slots).some(([otherSlot, id]) => otherSlot !== slot && id === selected.id)) {
      notify("Ce Dofus ou trophée est déjà équipé.");
      return;
    }
    setBuild((previous) => ({ ...previous, slots: { ...previous.slots, [slot]: selected.id } }));
    setRequest((previous) => {
      const lockedSlots = { ...previous.filters.lockedSlots };
      if (lockedSlots[slot] && lockedSlots[slot] !== selected.id)
        delete lockedSlots[slot];
      return { ...previous, filters: { ...previous.filters, lockedSlots } };
    });
    setBrowser(null);
    notify(`${selected.name} équipé.`);
  }
  function toggleEquipmentLock(slot: Slot) {
    const id = build.slots[slot];
    if (!id || starting || activeJob) return;
    setRequest((previous) => {
      const lockedSlots = { ...previous.filters.lockedSlots };
      if (lockedSlots[slot] === id) delete lockedSlots[slot];
      else lockedSlots[slot] = id;
      return withEquipmentLocks(previous, catalog, lockedSlots);
    });
  }
  async function optimize() {
    if (starting || activeJob) return;
    if (!characterAllocation.valid) {
      setError(characterAllocation.violations.join(" "));
      setTab("builder");
      return;
    }
    setError("");
    setStarting(true);
    try {
      const result = await api.optimize({ ...request, catalogRevision: catalog.revision, initialBuild: { ...build, baseStats: request.character.allocationMode === "automatic" ? build.baseStats : undefined, exoBonuses: (build.exoBonuses || []).filter((exo) => request.filters.allowedExos?.includes(exo)).slice(0, request.filters.maxExos ?? 2) } });
      setCatalogUpdated(false);
      setReceipt(result);
      setJob({
        id: result.id,
        status: result.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: {
          percent: 0,
          evaluated: 0,
          feasible: 0,
          elapsedMs: 0,
          bestScore: null,
        },
        results: [],
        catalogVersion: catalog.version,
        catalogRevision: catalog.revision,
      });
      setTab("equipment");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de démarrer la recherche.",
      );
    } finally {
      setStarting(false);
    }
  }
  async function cancel() {
    if (!receipt) return;
    try {
      await api.cancel(receipt);
      notify("Arrêt demandé. Les meilleurs résultats seront conservés.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’arrêter la recherche.",
      );
    }
  }
  function changeLevel(level: number) {
    const safe = Math.max(1, Math.min(200, Math.trunc(Number.isFinite(level) ? level : 1)));
    setRequest((previous) => ({
      ...previous,
      character: { ...previous.character, level: safe },
    }));
  }
  const titles: Record<Tab, [string, string, string]> = {
    builder: [
      "À CHAQUE AVENTURE, SON STUFF",
      "Ton prochain stuff commence ici.",
      "Choisis tes envies. Classe tes priorités. Trouve l’équipement qui te ressemble.",
    ],
    equipment: [
      "L’ÉQUIPEMENT, EN UN COUP D’ŒIL",
      "Un stuff qui coche tes cases.",
      "Compare les résultats ou compose ton équipement, pièce par pièce.",
    ],
    spells: [
      "MOINS DE SUPPOSITIONS, PLUS DE DÉGÂTS",
      "Chaque sort. Chaque lancer.",
      "Explore ton grimoire et mesure ce que ton équipement change vraiment.",
    ],
    market: [
      "LE BON STUFF, AU BON PRIX",
      "Ton serveur. Ton budget.",
      "Des prix que tu maîtrises, pour estimer le coût de ton stuff.",
    ],
  };
  const profileExport = () =>
    downloadJson("dofus-stuffer-profil.json", {
      version: 4,
      catalogVersion: catalog.version,
      catalogRevision: catalog.revision,
      request,
      build,
      priceBooks: { ...priceBooks, [request.prices.server]: request.prices },
    });

  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setTab("builder");
          }}
        >
          <span className="brand-mark">
            <img src="/brand/dofus-stuffer-icon-192.png" alt="" width="43" height="43" />
          </span>
          <span>
            <strong>
              DOFUS <span>STUFFER</span>
            </strong>
            <small>L’ATELIER DU STUFF</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Navigation principale">
          {tabs.map(({ id, label, Icon }) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
        <div className="header-status">
          <span className="online-dot" />
          DOFUS PC · PVM
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="online-dot" />
              {titles[tab][0]}
            </div>
            <h1>{titles[tab][1]}</h1>
            <p>{titles[tab][2]}</p>
          </div>
          <div className="heading-aside">
            <button className="button ghost" onClick={profileExport}>
              <Download size={14} /> Mon profil
            </button>
            <button
              className="icon-button"
              onClick={() => setHelp(true)}
              aria-label="Guide rapide"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
        {error && (
          <div className="notice error page-notice" role="alert">
            <Info size={16} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              className="icon-button"
              aria-label="Fermer l’erreur"
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {catalogUpdated && <div className="notice page-notice" role="status"><Info size={16} /><span>Le catalogue a changé depuis ta dernière recherche. Ton stuff est recalculé avec les règles actuelles. Relance une recherche pour obtenir de nouveaux résultats.</span><button className="icon-button" aria-label="Fermer l’information de mise à jour" onClick={() => setCatalogUpdated(false)}><X size={14} /></button></div>}
        {exosUpdated && <div className="notice page-notice" role="status"><Info size={16} /><span>Les exos s’appliquent maintenant au stuff, avec l’objet au choix. Tes objets et ta répartition sont conservés. Renseigne leurs suppléments dans Marché ; les anciens prix d’objets FM ne permettent pas de les déduire. Relance une recherche pour actualiser les résultats.</span><button className="icon-button" aria-label="Fermer l’information sur les exos" onClick={() => setExosUpdated(false)}><X size={14} /></button></div>}
        {!!catalog.warnings?.length && <details className="catalog-notes">
          <summary><Info size={13} /> Catalogue {catalog.version} · informations sur les données</summary>
          <div><p>Importé le {new Date(catalog.fetchedAt).toLocaleString("fr-FR")}. Les valeurs affichées et les recherches utilisent cette version.</p><ul>{catalog.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>
        </details>}
        {tab === "builder" && (
          <div className="builder-grid">
            <div className="builder-main">
              <section className="panel">
                <div className="panel-head">
                  <h2>Mon personnage</h2>
                  <span className="mode-badge">
                    <ShieldCheck size={11} /> PvM
                  </span>
                </div>
                <div className="profile-layout">
                  <div>
                    <div className="section-label">CHOISIR UNE CLASSE</div>
                    <div className="class-grid">
                      {catalog.classes.map((gameClass) => (
                        <button
                          className={`class-tile ${request.character.classId === gameClass.id ? "selected" : ""}`}
                          key={gameClass.id}
                          title={gameClass.name}
                          aria-label={gameClass.name}
                          aria-pressed={
                            request.character.classId === gameClass.id
                          }
                          onClick={() =>
                            setRequest((previous) => ({
                              ...previous,
                              character: {
                                ...previous.character,
                                classId: gameClass.id,
                              },
                            }))
                          }
                        >
                          <GameImage src={gameClass.icon} />
                        </button>
                      ))}
                    </div>
                    <div className="class-name">
                      <Check size={11} />
                      {currentClass?.name} sélectionné
                    </div>
                  </div>
                  <div className="profile-fields">
                    <div className="inline-field">
                      <label htmlFor="character-level">Niveau</label>
                      <div className="level-stepper">
                        <button
                          onClick={() =>
                            changeLevel(request.character.level - 1)
                          }
                          aria-label="Réduire le niveau"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          id="character-level"
                          type="number"
                          min="1"
                          max="200"
                          value={request.character.level}
                          onChange={(event) =>
                            changeLevel(Number(event.target.value))
                          }
                        />
                        <button
                          onClick={() =>
                            changeLevel(request.character.level + 1)
                          }
                          aria-label="Augmenter le niveau"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="inline-field">
                      <label htmlFor="server-select">Serveur</label>
                      <select
                        id="server-select"
                        value={request.prices.server}
                        onChange={(event) => changeServer(event.target.value)}
                      >
                        {Array.from(
                          new Set([request.prices.server, ...catalog.servers]),
                        ).map((server) => (
                          <option key={server}>{server}</option>
                        ))}
                      </select>
                    </div>
                    <div className="inline-field">
                      <span className="section-help">Niveau rapide</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[100, 150, 200].map((level) => (
                          <button
                            className={`button small ${request.character.level === level ? "primary" : "ghost"}`}
                            key={level}
                            onClick={() => changeLevel(level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <CharacterEditor
                  catalog={catalog}
                  character={request.character}
                  proposedStats={build.baseStats}
                  onChange={(character) => {
                    setRequest((previous) => ({ ...previous, character }));
                  }}
                />
              </section>
              <CriteriaCatalog
                catalog={catalog}
                request={request}
                weapon={catalog.items.find((item) => item.id === build.slots.weapon)}
                onAdd={addCriterion}
                onEdit={setEditing}
              />
              <EquipmentFilters
                catalog={catalog}
                request={request}
                onChange={setRequest}
                onBrowse={() => setBrowser({})}
              />
            </div>
            <aside className="builder-side">
              <Priorities
                catalog={catalog}
                constraints={request.constraints}
                onChange={(constraints) =>
                  setRequest((previous) => ({ ...previous, constraints }))
                }
                onEdit={setEditing}
                saved={saved}
                evaluation={evaluation}
              />
              <section className="launch-panel">
                <div className="launch-line">
                  <span>Temps de recherche</span>
                  <select
                    aria-label="Temps de recherche"
                    value={request.seconds}
                    onChange={(event) =>
                      setRequest((previous) => ({
                        ...previous,
                        seconds: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="5">Rapide · 5 s</option>
                    <option value="15">Équilibré · 15 s</option>
                    <option value="60">Approfondi · 1 min</option>
                    <option value="120">Patient · 2 min</option>
                    <option value="300">Poussé · 5 min</option>
                    <option value="600">Intensif · 10 min</option>
                  </select>
                </div>
                <p className="launch-caption">
                  <Sparkles size={11} /> Des résultats qui s’améliorent au fil
                  de la recherche
                </p>
                {activeJob && (
                  <button
                    className="button ghost small wide"
                    style={{ marginTop: 12 }}
                    onClick={() => setTab("equipment")}
                  >
                    Suivre la recherche
                  </button>
                )}
              </section>
              <div className="summary-note">
                <Info size={17} />
                <p>
                  <strong>Ton ordre, tes choix.</strong>
                  <br />
                  Une cible obligatoire doit être respectée. Pour le reste, le
                  moteur cherche le meilleur compromis selon tes priorités et limite les malus, même sur les caractéristiques sans objectif.
                </p>
              </div>
            </aside>
          </div>
        )}
        {tab === "equipment" && (
          <>
            {job && (
              <section className="panel progress-card" aria-live="polite">
                <div className="progress-head">
                  <h3>
                    {activeJob ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : job.status === "failed" ? (
                      <Info size={18} />
                    ) : (
                      <Check size={18} />
                    )}
                    {job.status === "queued"
                      ? "Ta recherche attend son tour"
                      : job.status === "running"
                        ? "On explore les combinaisons"
                        : job.status === "completed"
                          ? "Recherche terminée"
                          : job.status === "cancelled"
                            ? "Recherche arrêtée"
                            : "La recherche a rencontré un problème"}
                  </h3>
                  {activeJob ? (
                    <button
                      className="button small ghost"
                      onClick={() => void cancel()}
                    >
                      <Square size={11} /> Arrêter
                    </button>
                  ) : (
                    <button
                      className="button small ghost"
                      onClick={() => void optimize()}
                      disabled={starting}
                    >
                      <RotateCcw size={12} /> Relancer
                    </button>
                  )}
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, job.progress.percent))}%`,
                    }}
                  />
                </div>
                <div className="progress-meta">
                  <span>
                    {fmt(job.progress.evaluated)} combinaisons ·{" "}
                    {fmt(job.progress.feasible)} valides
                  </span>
                  <span>
                    {fmt(job.progress.elapsedMs / 1000)} s
                    {activeJob &&
                      (connected
                        ? " · En direct"
                        : " · Actualisation automatique")}
                  </span>
                </div>
                {job.message && <p className="inline-notice">{job.message}</p>}
                {job.error && (
                  <p className="inline-notice" role="alert">
                    {job.error}
                  </p>
                )}
              </section>
            )}
            {!!job?.results.length && (
              <div className="results-tabs">
                {job.results.map((result, index) => {
                  const changesLockedItem = Object.entries(request.filters.lockedSlots)
                    .some(([slot, id]) => result.build.slots[slot as Slot] !== id);
                  return (
                  <button
                    key={index}
                    className={`result-tab ${selectedResult === index ? "active" : ""}`}
                    disabled={changesLockedItem}
                    title={changesLockedItem ? "Cette alternative remplace une pièce verrouillée. Déverrouille-la ou relance la recherche avec ta base." : undefined}
                    onClick={() => {
                      setSelectedResult(index);
                      setBuild(result.build);
                    }}
                  >
                    <span>
                      {index === 0 ? (
                        <Sparkles size={18} />
                      ) : (
                        <Layers3 size={18} />
                      )}
                    </span>
                    <span>
                      <strong>
                        {index === 0
                          ? "Meilleur stuff trouvé"
                          : `Alternative ${index + 1}`}
                      </strong>
                      <small>
                        {money(result.cost)} ·{" "}
                        {result.valid
                          ? `${result.constraints.filter((criterion) => criterion.satisfied).length} / ${result.constraints.length} objectifs atteints`
                          : "À vérifier"}
                      </small>
                    </span>
                  </button>
                  );
                })}
              </div>
            )}
            {job?.status === "completed" && !job.results.length && (
              <div className="notice warning page-notice">
                <Info size={16} />
                <div>
                  Aucun stuff respectant toutes les contraintes obligatoires n’a
                  été trouvé dans le temps imparti. Essaie une recherche plus
                  longue ou ajuste tes critères. Cela ne prouve pas qu’aucune
                  solution n’existe.
                </div>
              </div>
            )}
            {!Object.keys(build.slots).length && !activeJob && (
              <div className="notice page-notice">
                <Package size={17} />
                <div>
                  Ton mannequin est prêt. Lance une recherche depuis l’atelier,
                  ou clique sur un emplacement pour équiper ton premier objet.
                </div>
              </div>
            )}
            <BuildView
              catalog={catalog}
              request={request}
              evaluation={evaluation}
              onSlot={(slot, selected) => {
                setItemSlot(slot);
                selected ? setItem(selected) : setBrowser({ slot });
              }}
              onSpells={() => setTab("spells")}
              onPrices={() => setTab("market")}
              onClear={() => {
                setBuild((previous) => ({ ...previous, slots: {} }));
                setRequest((previous) => withEquipmentLocks(previous, catalog, {}));
                notify("Tous les objets ont été retirés du mannequin.");
              }}
              onLock={toggleEquipmentLock}
              onLockAll={() => setRequest((previous) => withEquipmentLocks(previous, catalog, build.slots))}
              onUnlockAll={() => setRequest((previous) => withEquipmentLocks(previous, catalog, {}))}
              searching={starting || !!activeJob}
              onExo={(exo, enabled) => {
                setBuild((previous) => ({ ...previous, exoBonuses: enabled ? [...new Set([...(previous.exoBonuses || []), exo])] : (previous.exoBonuses || []).filter((value) => value !== exo) }));
              }}
            />
            {!evaluation.valid && <div className="notice warning build-legality" style={{ marginTop: 18 }} role="status">
              <Info size={17} /><div><strong>Ce stuff ne respecte pas encore toutes les règles.</strong><ul>{evaluation.violations.map((violation, index) => <li key={index}>{violation}</li>)}</ul></div>
            </div>}
            <div className="profile-actions">
              <button className="button" onClick={() => setBrowser({})}>
                <Package size={14} /> Parcourir les équipements
              </button>
              <button
                className="button ghost"
                onClick={() => setTab("builder")}
              >
                <SlidersHorizontal size={14} /> Ajuster mes priorités
              </button>
              <button
                className="button ghost"
                onClick={() =>
                  downloadJson("dofus-stuffer-equipement.json", {
                    version: catalog.version,
                    character: request.character,
                    build,
                    stats: evaluation.stats,
                    constraints: request.constraints,
                  })
                }
              >
                <Download size={14} /> Exporter mon stuff
              </button>
            </div>
            {(evaluation.violations.length > 0 ||
              evaluation.warnings.length > 0) &&
              Object.keys(build.slots).length > 0 && (
                <details className="panel" style={{ marginTop: 23 }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#bdcba8",
                    }}
                  >
                    Vérifications et limites du stuff (
                    {evaluation.violations.length + evaluation.warnings.length})
                  </summary>
                  <ul className="section-help" style={{ marginTop: 15 }}>
                    {[...evaluation.violations, ...evaluation.warnings].map(
                      (warning, index) => (
                        <li key={index}>{warning}</li>
                      ),
                    )}
                  </ul>
                </details>
              )}
          </>
        )}
        {tab === "spells" && (
          <SpellView
            catalog={catalog}
            request={request}
            evaluation={evaluation}
            onChange={setRequest}
            onAdd={addCriterion}
            onWeapon={() => setBrowser({ slot: "weapon" })}
          />
        )}
        {tab === "market" && (
          <Market
            catalog={catalog}
            request={request}
            priceSync={priceSync}
            maintenance={maintenance}
            onChange={setRequest}
            onServer={changeServer}
            notify={notify}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>
          <span className="online-dot" /> Catalogue {catalog.version} ·{" "}
          {fmt(catalog.items.length)} objets · {fmt(catalog.spells.length)}{" "}
          sorts
        </span>
        <span>
          Projet indépendant · Données et visuels © Ankama
        </span>
      </footer>
      <button
        className="button primary launch-button"
        disabled={
          starting || !!activeJob || request.constraints.length === 0 || !characterAllocation.valid
        }
        onClick={() => void optimize()}
      >
        {starting || activeJob ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <WandSparkles size={18} />
        )}
        {starting
          ? "Démarrage…"
          : activeJob
            ? "Recherche en cours"
            : Object.keys(request.filters.lockedSlots).length > 0
              ? "Relancer avec ma base"
              : "Trouver mon stuff"}
        {!starting && !activeJob && <ArrowRight size={16} />}
      </button>
      {editing && (
        <ConstraintEditor
          criterion={editing}
          constraints={request.constraints}
          catalog={catalog}
          characterLevel={request.character.level}
          stats={evaluation.stats}
          weapon={catalog.items.find((item) => item.id === build.slots.weapon)}
          onSave={saveCriterion}
          onClose={closeEditor}
        />
      )}
      {browser && (
        <Modal
          title={
            browser.slot
              ? "Choisir un objet pour cet emplacement"
              : "Catalogue des équipements"
          }
          onClose={closeBrowser}
          wide
        >
          <p>
            Équipe un objet, impose-le à l’optimiseur ou exclus-le de tes
            recherches.
          </p>
          <ItemBrowser
            catalog={catalog}
            request={request}
            build={build}
            onChange={setRequest}
            onEquip={equip}
            onItem={(selected) => {
              setItemSlot(browser.slot);
              setBrowser(null);
              setItem(selected);
            }}
            slot={browser.slot}
          />
        </Modal>
      )}
      {item && (
        <ItemDetail
          item={item}
          catalog={catalog}
          request={request}
          onChange={setRequest}
          onEquip={(selected) => equip(selected, itemSlot ?? equippedItemSlot)}
          onClose={closeItem}
          build={build}
          slot={itemSlot}
          onRemove={
            equippedItemSlot
              ? () => {
                  const removedSlot = equippedItemSlot;
                  setBuild((previous) => {
                    const slots = { ...previous.slots };
                    delete slots[removedSlot];
                    return { ...previous, slots };
                  });
                  setRequest((previous) => ({
                    ...previous,
                    filters: {
                      ...previous.filters,
                      lockedSlots: Object.fromEntries(
                        Object.entries(previous.filters.lockedSlots).filter(
                          ([slot]) => slot !== removedSlot,
                        ),
                      ),
                    },
                  }));
                  setItem(null);
                  notify("Objet retiré du stuff.");
                }
              : undefined
          }
          onReplace={
            equippedItemSlot
              ? () => {
                  setItem(null);
                  setBrowser({ slot: equippedItemSlot });
                }
              : undefined
          }
        />
      )}
      {help && (
        <Modal title="Ton atelier, en quelques clics" onClose={closeHelp}>
          <p>Une recherche se construit autour de ce qui compte pour toi.</p>
          <div className="stats-list">
            <div className="notice">
              <span>1.</span>
              <div>
                <strong>Choisis tes critères.</strong> Caractéristiques, dégâts
                et chance de critique d’un sort, budget : chaque cible se règle au clic.
              </div>
            </div>
            <div className="notice">
              <span>2.</span>
              <div>
                <strong>Classe tes priorités.</strong> Déplace un critère dans
                un autre niveau pour l’associer aux autres. Utilise les flèches
                pour réordonner les niveaux.
              </div>
            </div>
            <div className="notice">
              <span>3.</span>
              <div>
                <strong>Explore les résultats.</strong> Les calculs longs
                continuent sur le serveur. Tes dégâts et statistiques se
                recalculent immédiatement quand tu modifies le stuff.
              </div>
            </div>
          </div>
          <p className="inline-notice">
            Le moteur renvoie le meilleur résultat trouvé, sans preuve
            d’optimalité globale. Les calculs complexes non pris en charge et
            les prix manquants sont signalés.
          </p>
          <div className="modal-actions">
            <button className="button primary" onClick={closeHelp}>
              C’est parti
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    api
      .catalog()
      .then((value) => {
        if (!cancelled) setCatalog(value);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Le catalogue est indisponible.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  if (!catalog)
    return (
      <div className="loading-screen">
        {error ? (
          <div className="empty-state" style={{ maxWidth: 520 }}>
            <Info size={24} />
            <h3>Le catalogue n’est pas encore disponible</h3>
            <p>{error}</p>
            <p>Vérifie que l’application et ses services sont démarrés.</p>
            <button
              className="button primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RotateCcw size={14} /> Réessayer
            </button>
          </div>
        ) : (
          <>
            <LoaderCircle className="spin" size={23} />
            <span>Ouverture de ton atelier…</span>
          </>
        )}
      </div>
    );
  return <Workspace catalog={catalog} />;
}
