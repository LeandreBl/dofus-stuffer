import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Crown,
  Diamond,
  Footprints,
  Info,
  Layers3,
  LockKeyhole,
  Package,
  Plus,
  Shield,
  Sparkles,
  Swords,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  CHARACTER_STATS,
  evaluateBuild,
  formatItemCondition,
  inspectEquipment,
  slotType,
  type Build,
  type BuildEvaluation,
  type Catalog,
  type ConditionDiagnostic,
  type EquipmentItem,
  type ExoStat,
  type OptimizationRequest,
  type Slot,
} from "@dofus/shared";
import { constraintName } from "./Constraints";
import { ItemHover } from "./ItemHover";
import { CharacterPreview } from "./CharacterPreview";
import { BuildPrice } from "./BuildPrice";
import { manualBuildRequest } from "./build-preview";
import { fmt, GameImage, Modal, money, SearchField, StatIcon, statUnit } from "./ui";

const slotNames: Record<Slot, string> = {
  amulet: "Amulette",
  ring1: "Anneau",
  ring2: "Anneau",
  hat: "Coiffe",
  cape: "Cape",
  belt: "Ceinture",
  boots: "Bottes",
  weapon: "Arme",
  shield: "Bouclier",
  pet: "Familier / monture",
  dofus1: "Dofus / trophée",
  dofus2: "Dofus / trophée",
  dofus3: "Dofus / trophée",
  dofus4: "Dofus / trophée",
  dofus5: "Dofus / trophée",
  dofus6: "Dofus / trophée",
};

function conditionMentionsMobility(condition: ConditionDiagnostic): boolean {
  return condition.stat === "actionPoints" || condition.stat === "movementPoints" || Boolean(condition.children?.some(conditionMentionsMobility));
}

function ConditionStatus({ condition, optional = false }: { condition: ConditionDiagnostic; optional?: boolean }) {
  const state = optional && condition.satisfied !== true ? "optional" : condition.satisfied === null ? "unknown" : condition.satisfied ? "satisfied" : "failed";
  const Icon = condition.satisfied === true ? Check : optional ? Info : condition.satisfied === false ? X : Info;
  const compound = condition.kind === "and" || condition.kind === "or";
  return <div className={`item-condition ${state}`}>
    <div className="item-condition-line">
      <Icon size={13} aria-hidden="true" />
      <span>{compound ? condition.kind === "and" ? "Toutes ces conditions" : "Au moins une de ces conditions" : condition.text}</span>
      <small>{optional && condition.satisfied !== true ? "Non nécessaire" : condition.satisfied === null ? "À vérifier" : condition.satisfied ? "Respectée" : "Non respectée"}</small>
    </div>
    {compound && condition.children?.length ? <div className="item-condition-children">{condition.children.map((child, index) => <ConditionStatus key={index} condition={child} optional={optional || (condition.kind === "or" && condition.satisfied === true)} />)}</div> : condition.actual !== undefined && <p className="item-condition-value">{["strength", "intelligence", "chance", "agility"].includes(condition.stat || "") ? "Valeur réelle, sans puissance" : "Valeur avec ce stuff"} : <strong>{fmt(condition.actual)}</strong></p>}
  </div>;
}
export function chooseSlot(item: EquipmentItem, build: Build): Slot {
  if (item.slotType === "ring")
    return !build.slots.ring1
      ? "ring1"
      : !build.slots.ring2
        ? "ring2"
        : "ring1";
  if (item.slotType === "dofus")
    return (
      ([1, 2, 3, 4, 5, 6].map((value) => `dofus${value}`) as Slot[]).find(
        (slot) => !build.slots[slot],
      ) || "dofus1"
    );
  return item.slotType as Slot;
}
export function EquipmentFilters({
  catalog,
  request,
  onChange,
  onBrowse,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
  onBrowse: () => void;
}) {
  const categories = Array.from(
    new Set(catalog.items.map((item) => item.category)),
  );
  const maxExos = request.filters.maxExos ?? 2;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>
            <Package size={17} /> Objets autorisés
          </h2>
          <p>Garde le contrôle sur ce que le moteur peut équiper.</p>
        </div>
        <button
          className="icon-button"
          onClick={onBrowse}
          aria-label="Ouvrir le catalogue d’objets"
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="category-toggles">
        {categories.map((category) => {
          const excluded =
            request.filters.excludedCategories.includes(category);
          return (
            <button
              key={category}
              className={`category-toggle ${excluded ? "off" : ""}`}
              onClick={() =>
                onChange({
                  ...request,
                  filters: {
                    ...request.filters,
                    excludedCategories: excluded
                      ? request.filters.excludedCategories.filter(
                          (value) => value !== category,
                        )
                      : [...request.filters.excludedCategories, category],
                  },
                })
              }
            >
              {category}
              <span className="switch" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="fm-controls">
        <h3>Exos autorisés dans la recherche</h3>
        <div className="exo-limit-row">
          <span id="exo-limit-label">Maximum d’exos</span>
          <div className="exo-limit-options" role="group" aria-labelledby="exo-limit-label">
            {[0, 1, 2].map((maximum) => <button key={maximum} className={maxExos === maximum ? "active" : ""} aria-pressed={maxExos === maximum} aria-label={`${maximum} exo${maximum > 1 ? "s" : ""} maximum`} onClick={() => onChange({ ...request, filters: { ...request.filters, maxExos: maximum } })}>{maximum}</button>)}
          </div>
        </div>
        <div className="fm-toggles">
          {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => {
            const enabled = request.filters.allowedExos?.includes(exo) || false;
            return <button key={exo} className={`category-toggle ${enabled ? "" : "off"}`} aria-pressed={enabled} disabled={maxExos === 0} onClick={() => onChange({ ...request, filters: { ...request.filters, allowedExos: enabled ? request.filters.allowedExos?.filter((value) => value !== exo) : [...(request.filters.allowedExos || []), exo] } })}>
              <StatIcon stat={catalog.stats.find((stat) => stat.key === exo)} /> Exo {exo === "actionPoints" ? "PA" : "PM"}<span className="switch" aria-hidden="true" />
            </button>;
          })}
        </div>
        <p className="character-rule" style={{ marginTop: 9 }}>{maxExos === 0 ? "Aucun exo ne sera utilisé." : maxExos === 1 ? "Au plus un exo : le moteur choisit PA ou PM parmi les types autorisés." : "Au plus deux exos : +1 PA et +1 PM, selon les types autorisés."} Tu choisiras ensuite les objets à forgemager. Les suppléments se règlent dans Marché.</p>
      </div>
      <div className="profile-actions">
        <button className="button ghost small" onClick={onBrowse}>
          <SlidersIcon /> Filtrer les objets et les types{" "}
          <ChevronRight size={13} />
        </button>
        {request.filters.excludedItemIds.length > 0 && (
          <span className="counter">
            {request.filters.excludedItemIds.length} exclus
          </span>
        )}
        {Object.keys(request.filters.lockedSlots).length > 0 && (
          <span className="counter">
            {Object.keys(request.filters.lockedSlots).length} verrouillés
          </span>
        )}
      </div>
    </section>
  );
}
function SlidersIcon() {
  return <Layers3 size={13} />;
}

export function ItemBrowser({
  catalog,
  request,
  build,
  onChange,
  onEquip,
  onItem,
  slot,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem, slot?: Slot) => void;
  onItem: (item: EquipmentItem) => void;
  slot?: Slot;
}) {
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [limit, setLimit] = useState(36);
  const relevant = useMemo(
    () =>
      catalog.items.filter((item) => !slot || item.slotType === slotType(slot)),
    [catalog, slot],
  );
  const types = Array.from(
    new Map(relevant.map((item) => [item.typeId, item.typeName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const items = relevant.filter(
    (item) =>
      item.level <= request.character.level &&
      (typeId === "all" || String(item.typeId) === typeId) &&
      item.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(
          search
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase(),
        ) &&
      (visibility === "all" ||
        (visibility === "excluded" &&
          request.filters.excludedItemIds.includes(item.id)) ||
        (visibility === "locked" &&
          Object.values(request.filters.lockedSlots).includes(item.id))),
  );
  const toggleExcluded = (item: EquipmentItem) => {
    const excluded =
      request.filters.excludedItemIds.includes(item.id) ||
      request.filters.excludedTypeIds.includes(item.typeId) ||
      request.filters.excludedCategories.includes(item.category);
    const locked = { ...request.filters.lockedSlots };
    if (!excluded)
      Object.keys(locked).forEach((key) => {
        if (locked[key as Slot] === item.id) {
          delete locked[key as Slot];
        }
      });
    onChange({
      ...request,
      filters: {
        ...request.filters,
        lockedSlots: locked,
        excludedCategories: excluded
          ? request.filters.excludedCategories.filter(
              (value) => value !== item.category,
            )
          : request.filters.excludedCategories,
        excludedTypeIds: excluded
          ? request.filters.excludedTypeIds.filter(
              (value) => value !== item.typeId,
            )
          : request.filters.excludedTypeIds,
        excludedItemIds: excluded
          ? request.filters.excludedItemIds.filter((id) => id !== item.id)
          : [...request.filters.excludedItemIds, item.id],
      },
    });
  };
  const toggleLock = (item: EquipmentItem) => {
    const lockedSlots = { ...request.filters.lockedSlots };
    const current = slot ? (lockedSlots[slot] === item.id ? slot : undefined) : (Object.keys(lockedSlots) as Slot[]).find(
      (key) => lockedSlots[key] === item.id,
    );
    if (current) {
      delete lockedSlots[current];
    }
    else {
      const destination =
        slot || (Object.keys(build.slots) as Slot[]).find((key) => build.slots[key] === item.id) || chooseSlot(item, { slots: { ...build.slots, ...lockedSlots } });
      lockedSlots[destination] = item.id;
    }
    onChange({
      ...request,
      filters: {
        ...request.filters,
        lockedSlots,
        excludedItemIds: request.filters.excludedItemIds.filter(
          (id) => id !== item.id,
        ),
        excludedCategories: request.filters.excludedCategories.filter(
          (value) => value !== item.category,
        ),
        excludedTypeIds: request.filters.excludedTypeIds.filter(
          (value) => value !== item.typeId,
        ),
      },
    });
  };
  return (
    <>
      <div className="catalog-toolbar">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setLimit(36);
          }}
          placeholder="Chercher un objet, une panoplie…"
        />
        <select
          aria-label="Type d’objet"
          value={typeId}
          onChange={(event) => {
            setTypeId(event.target.value);
            setLimit(36);
          }}
        >
          <option value="all">Tous les types</option>
          {types.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Afficher les objets"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
        >
          <option value="all">Tous les objets</option>
          <option value="excluded">Objets exclus</option>
          <option value="locked">Objets verrouillés</option>
        </select>
      </div>
      {typeId !== "all" && (
        <button
          className="button small ghost"
          onClick={() => {
            const id = Number(typeId);
            const excluded = request.filters.excludedTypeIds.includes(id);
            onChange({
              ...request,
              filters: {
                ...request.filters,
                excludedTypeIds: excluded
                  ? request.filters.excludedTypeIds.filter(
                      (value) => value !== id,
                    )
                  : [...request.filters.excludedTypeIds, id],
              },
            });
          }}
        >
          {request.filters.excludedTypeIds.includes(Number(typeId)) ? (
            <Check size={13} />
          ) : (
            <CircleSlash size={13} />
          )}
          {request.filters.excludedTypeIds.includes(Number(typeId))
            ? "Réautoriser ce type entier"
            : "Exclure ce type entier"}
        </button>
      )}
      <div className="items-grid">
        {items.slice(0, limit).map((item) => {
          const excluded =
            request.filters.excludedItemIds.includes(item.id) ||
            request.filters.excludedTypeIds.includes(item.typeId) ||
            request.filters.excludedCategories.includes(item.category);
          const locked = slot ? request.filters.lockedSlots[slot] === item.id : Object.values(request.filters.lockedSlots).includes(item.id);
          return (
            <ItemHover key={item.id} item={item} catalog={catalog} request={request}><article
              key={item.id}
              className={`item-card ${excluded ? "excluded" : ""} ${locked ? "locked" : ""}`}
            >
              <button
                className="item-card-head"
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  textAlign: "left",
                  width: "100%",
                }}
                onClick={() => onItem(item)}
              >
                <GameImage src={item.icon} />
                <div>
                  <h3>{item.name}</h3>
                  <small>
                    Niv. {item.level} · {item.typeName}
                  </small>
                </div>
              </button>
              <div className="item-stats">
                {Object.entries(item.stats)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key}>
                      {fmt(value)}{" "}
                      {catalog.stats.find((stat) => stat.key === key)?.name ||
                        key}
                    </span>
                  ))}
              </div>
              {item.conditions && <p className="item-condition-preview"><Info size={12} aria-hidden="true" /><span>{formatItemCondition(item.conditions, catalog)}</span></p>}
              {!item.conditions && item.conditionsText && <p className="item-condition-preview"><Info size={12} aria-hidden="true" /><span>Conditions à vérifier · voir la fiche</span></p>}
              {!!item.dataWarnings?.length && <p className="item-data-note"><Info size={11} /> Données à vérifier · voir la fiche</p>}
              <div className="item-card-actions">
                <button
                  className="icon-button"
                  aria-label={`${excluded ? "Autoriser" : "Exclure"} ${item.name}`}
                  title={excluded ? "Autoriser cet objet" : "Exclure cet objet"}
                  onClick={() => toggleExcluded(item)}
                >
                  {excluded ? <Plus size={14} /> : <CircleSlash size={14} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={`${locked ? "Déverrouiller" : "Verrouiller"} ${item.name}`}
                  title={locked ? "Déverrouiller" : "Imposer cet objet"}
                  onClick={() => toggleLock(item)}
                >
                  {locked ? (
                    <LockKeyhole size={14} color="#d1e97f" />
                  ) : (
                    <UnlockKeyhole size={14} />
                  )}
                </button>
                <button
                  className="button small"
                  onClick={() => onEquip(item, slot)}
                >
                  Équiper
                </button>
              </div>
            </article></ItemHover>
          );
        })}
      </div>
      {!items.length && (
        <div className="empty-state">
          <Package size={22} />
          <p>Aucun objet trouvé pour ces filtres et ce niveau.</p>
        </div>
      )}
      {items.length > limit && (
        <button
          className="button ghost more-button"
          onClick={() => setLimit((value) => value + 48)}
        >
          Afficher plus d’objets <ChevronDown size={14} />
        </button>
      )}
      <p className="pagination-summary">
        {Math.min(limit, items.length)} sur {items.length} objets · jets
        maximums du catalogue
      </p>
    </>
  );
}

export function ItemDetail({
  item,
  catalog,
  request,
  onChange,
  onEquip,
  onClose,
  onRemove,
  onReplace,
  build,
  slot,
}: {
  item: EquipmentItem;
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem) => void;
  onClose: () => void;
  onRemove?: () => void;
  onReplace?: () => void;
  build: Build;
  slot?: Slot;
}) {
  const equippedSlot = slot ? build.slots[slot] === item.id ? slot : undefined : (Object.keys(build.slots) as Slot[]).find((key) => build.slots[key] === item.id);
  const priceKey = String(item.id);
  const selectedPrices = request.prices.values;
  const previewSlot = slot || equippedSlot || chooseSlot(item, build);
  const inspection = useMemo(() => {
    const preview = { ...build, slots: { ...build.slots, [previewSlot]: item.id } };
    const previewRequest = manualBuildRequest(request);
    return inspectEquipment(catalog, previewRequest, evaluateBuild(catalog, previewRequest, preview));
  }, [catalog, request, build, previewSlot, item.id]);
  const itemDiagnostic = inspection.items[previewSlot];
  const candidateIssues = inspection.issues.filter((issue) => issue.slots.includes(previewSlot));
  return (
    <Modal title="Détail de l’objet" onClose={onClose}>
      <div className="item-detail-heading">
        <GameImage src={item.icon} />
        <div>
          <h3>{item.name}</h3>
          <p>
            Niveau {item.level} · {item.typeName}
          </p>
        </div>
      </div>
      <div className="item-detail-stats">
        {Object.entries(item.stats).map(([key, value]) => (
          <div className="stat-line" key={key}>
            <StatIcon stat={catalog.stats.find((stat) => stat.key === key)} />
            <span>
              {catalog.stats.find((stat) => stat.key === key)?.name || key}
            </span>
            <strong>{fmt(value)}</strong>
          </div>
        ))}
      </div>
      {(itemDiagnostic?.condition || candidateIssues.length > 0 || item.conditionsText) && <section className="item-compatibility">
        <h4>Conditions d’équipement</h4>
        <p className="section-help">{equippedSlot ? "Vérifiées avec ton stuff actuel, exos compris." : "Aperçu si tu équipes cet objet à la place de l’emplacement choisi, exos compris."}</p>
        {itemDiagnostic?.condition ? <ConditionStatus condition={itemDiagnostic.condition} /> : item.conditionsText && <div className="notice warning"><Info size={15} /><div>Une condition particulière de cet objet n’est pas encore interprétée. Vérifie ses prérequis en jeu.</div></div>}
        {candidateIssues.length > 0 && <div className="item-compatibility-issues">{candidateIssues.map((issue, index) => <div className={`notice ${issue.severity === "error" ? "error" : "warning"}`} key={`${issue.code}-${index}`}><AlertTriangle size={14} /><div>{issue.message}</div></div>)}</div>}
      </section>}
      {!!item.unsupportedEffects?.length && (
        <div className="notice warning">
          <Info size={15} />
          <div>Effets non simulés : {item.unsupportedEffects.join(" · ")}</div>
        </div>
      )}
      {!!item.dataWarnings?.length && <div className="notice warning"><Info size={15} /><div>{item.dataWarnings.join(" ")}</div></div>}
      <label className="field">
        Prix de l’objet sur {request.prices.server} (kamas)
        <input
          type="number"
          min="0"
          value={selectedPrices[priceKey] ?? request.prices.automaticValues?.[priceKey] ?? ""}
          placeholder="Prix inconnu"
          onChange={(event) => {
            const values = { ...selectedPrices };
            if (event.target.value === "") delete values[priceKey];
            else
              values[priceKey] = Math.max(0, Number(event.target.value));
            onChange({
              ...request,
              prices: {
                ...request.prices,
                values,
                updatedAt: new Date().toISOString(),
              },
            });
          }}
        />
      </label>
      <p className="inline-notice">{selectedPrices[priceKey] !== undefined ? "Prix personnalisé" : request.prices.automaticValues?.[priceKey] !== undefined ? "Prix automatique" : "Aucun prix disponible"} · Effacer ton prix reprend le prix automatique disponible.</p>
      {selectedPrices[priceKey] !== undefined && request.prices.automaticValues?.[priceKey] !== undefined && <button className="button small ghost" onClick={() => {
        const values = { ...selectedPrices };
        delete values[priceKey];
        onChange({ ...request, prices: { ...request.prices, values, updatedAt: new Date().toISOString() } });
      }}>Reprendre le prix automatique · {fmt(request.prices.automaticValues[priceKey])} K</button>}
      <div className="modal-actions">
        {onRemove && (
          <button className="button ghost danger" onClick={onRemove}>
            Retirer
          </button>
        )}
        {onReplace && (
          <button className="button ghost" onClick={onReplace}>
            Remplacer
          </button>
        )}
        <button
          className="button primary"
          onClick={() => {
            onEquip(item);
            onClose();
          }}
        >
          {onRemove ? "Rééquiper" : "Équiper cet objet"}
        </button>
      </div>
    </Modal>
  );
}

export function BuildView({
  catalog,
  request,
  evaluation,
  onSlot,
  onSpells,
  onPrices,
  onClear,
  onExo,
  onLock,
  onLockAll,
  onUnlockAll,
  searching,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  evaluation: BuildEvaluation;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
  onSpells: () => void;
  onPrices: () => void;
  onClear: () => void;
  onExo: (exo: ExoStat, enabled: boolean) => void;
  onLock: (slot: Slot) => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  searching: boolean;
}) {
  const currentClass = catalog.classes.find(
    (entry) => entry.id === request.character.classId,
  );
  const stats = evaluation.stats;
  const maxExos = request.filters.maxExos ?? 2;
  const exoCount = new Set(evaluation.build.exoBonuses || []).size;
  const lockedCount = Object.keys(request.filters.lockedSlots).length;
  const equippedCount = Object.keys(evaluation.build.slots).length;
  const diagnostics = useMemo(() => inspectEquipment(catalog, manualBuildRequest(request), evaluation), [catalog, request, evaluation]);
  const mobilityConditions = Object.values(diagnostics.items).filter((item) => item?.condition && conditionMentionsMobility(item.condition));
  const invalidCount = Object.values(diagnostics.items).filter((item) => item?.invalid).length;
  const unverifiedCount = Object.values(diagnostics.items).filter((item) => !item?.invalid && item?.issues.some((issue) => issue.severity === "unknown")).length;
  const stat = (key: string) =>
    catalog.stats.find((entry) => entry.key === key);
  const showStats = (keys: string[]) => (
    <div className="stats-list">
      {keys.map((key) => (
        <div className="stat-line" key={key}>
          <StatIcon stat={stat(key)} />
          <span>{stat(key)?.name || key}</span>
          <strong>
            {fmt(stats[key] || 0)}
            {statUnit(stat(key))}
          </strong>
        </div>
      ))}
    </div>
  );
  function renderSlot(slot: Slot) {
    const item = catalog.items.find(
      (entry) => entry.id === evaluation.build.slots[slot],
    );
    const Icon =
      slot === "hat"
        ? Crown
        : slot === "weapon"
          ? Swords
          : slot === "shield"
            ? Shield
            : slot === "boots"
              ? Footprints
              : slot.startsWith("dofus")
                ? Diamond
                : Package;
    const diagnostic = diagnostics.items[slot];
    const unverified = diagnostic?.issues.some((issue) => issue.severity === "unknown");
    const reason = diagnostic?.issues.map((issue) => issue.message).join(" ");
    const condition = diagnostic?.condition?.text;
    const locked = !!item && request.filters.lockedSlots[slot] === item.id;
    const description = [item?.name || slotNames[slot], reason, condition ? `Condition : ${condition}` : undefined].filter(Boolean).join(" · ");
    return (
      <div key={slot} className="equipment-slot-wrapper">
      <ItemHover item={item} catalog={catalog} request={request} issues={diagnostic?.issues.map(issue => issue.message)}><button
        className={`equipment-slot ${locked ? "locked" : ""} ${diagnostic?.invalid ? "invalid" : unverified ? "unverified" : ""}`}
        onClick={() => onSlot(slot, item)}
        aria-label={`${slotNames[slot]} : ${item?.name || "emplacement vide"}${diagnostic?.invalid ? " · Incompatible" : unverified ? " · Compatibilité à vérifier" : ""}${reason ? ` · ${reason}` : ""}`}
        title={item ? undefined : description}
      >
        {item ? (
          <GameImage src={item.icon} />
        ) : (
          <>
            <Icon size={24} />
            <small>{slotNames[slot]}</small>
          </>
        )}
        {(diagnostic?.invalid || unverified) && <span className="slot-compatibility" aria-hidden="true">{diagnostic?.invalid ? <AlertTriangle size={12} /> : <Info size={12} />}</span>}
      </button></ItemHover>
      {item && <button className={`slot-lock-toggle ${locked ? "active" : ""}`}
        aria-label={`${locked ? "Déverrouiller" : "Conserver"} ${item.name} · ${slotNames[slot]}`}
        aria-pressed={locked} disabled={searching}
        title={locked ? "Déverrouiller cet objet pour la prochaine recherche" : "Conserver cet objet pendant la prochaine recherche"}
        onClick={() => onLock(slot)}>
        {locked ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}
      </button>}
      </div>
    );
  }
  const elements = ["neutral", "earth", "fire", "water", "air"];
  const keys = {
    neutral: "strength",
    earth: "strength",
    fire: "intelligence",
    water: "chance",
    air: "agility",
  } as Record<string, string>;
  return (
    <div className="build-layout">
      <aside className="build-side">
        <section className="panel build-essential-stats" aria-label="Caractéristiques essentielles">
          <h3>Caractéristiques essentielles</h3>
          {showStats([
            "hitPoints",
            "actionPoints",
            "movementPoints",
            "range",
            "maxSummonedCreaturesBoost",
            "criticalHit",
            "damagePercent",
          ])}
        </section>
        <section className="panel build-base-stats">
          <h3>Mes vraies caractéristiques</h3>
          <table className="stat-breakdown">
            <thead><tr><th>Carac.</th><th>Base</th><th>Parcho</th><th>Stuff</th><th>Total</th></tr></thead>
            <tbody>{CHARACTER_STATS.map((key) => {
              const detail = evaluation.breakdown?.[key];
              const total = stats[key] || 0;
              const power = ["strength", "intelligence", "chance", "agility"].includes(key) ? stats.damagePercent || 0 : 0;
              const names: Record<string, string> = { vitality: "Vita.", strength: "Force", intelligence: "Intel.", chance: "Chance", agility: "Agi.", wisdom: "Sag." };
              return <tr key={key} title={`${stat(key)?.name || key} : base + parchotage + équipement et panoplies${power ? `, ${fmt(total + power)} pour les dégâts avec la puissance` : ""}`}>
                <td><span><StatIcon stat={stat(key)} />{names[key]}</span></td>
                <td>{fmt(detail?.base ?? (request.character.allocationMode === "manual" ? request.character.baseStats[key] : evaluation.build.baseStats?.[key]) ?? 0)}</td>
                <td>{fmt(detail?.scroll ?? request.character.scrollStats?.[key] ?? 0)}</td>
                <td>{fmt(detail?.equipment ?? 0)}</td>
                <td><strong>{fmt(total)}</strong>{power !== 0 && <small>({fmt(total + power)})</small>}</td>
              </tr>;
            })}</tbody>
          </table>
          <p className="power-description">Entre parenthèses : total pour les dégâts avec la puissance. Les prérequis des objets utilisent la valeur sans puissance. Elle n’augmente ni la prospection, ni les soins, ni les autres bonus des caractéristiques.</p>
        </section>
        <section className="panel">
          <h3>Caractéristiques secondaires</h3>
          {showStats([
            "initiative",
            "magicFind",
            "healBonus",
            "allDamageBonus",
            "criticalDamageBonus",
            "tackleEvade",
            "tackleBlock",
          ])}
        </section>
      </aside>
      <section className="panel equipment-panel">
        <div className="equipment-title">
          <span>Ton équipement</span>
          <b>{Object.keys(evaluation.build.slots).length} / 16 objets</b>
        </div>
        {(equippedCount > 0 || lockedCount > 0) && <div className="equipment-locks">
          <div className="equipment-locks-heading"><LockKeyhole size={14} /><strong aria-live="polite">
            {lockedCount ? `Base verrouillée · ${lockedCount} objet${lockedCount > 1 ? "s" : ""}` : "Conserver des pièces"}
          </strong></div>
          <p>{lockedCount ? "La recherche garde ces pièces et optimise les autres emplacements." : "Clique sur le cadenas des objets à garder, puis relance la recherche."}</p>
          <div className="equipment-locks-actions">
            {equippedCount > 0 && <button className="button ghost small" disabled={searching} onClick={onLockAll}><LockKeyhole size={12} />Tout verrouiller</button>}
            {lockedCount > 0 && <button className="button ghost small" disabled={searching} onClick={onUnlockAll}><UnlockKeyhole size={12} />Tout déverrouiller</button>}
          </div>
        </div>}
        <div className="build-exos">
          {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => {
            const enabled = evaluation.build.exoBonuses?.includes(exo) || false;
            const diagnostic = diagnostics.exos[exo];
            const warning = !enabled && diagnostic.status === "blocked";
            const statusLabel = { active: "Actif · retirer", possible: "Ajouter", blocked: "À vérifier", noGain: "Sans gain" }[diagnostic.status];
            const unit = exo === "actionPoints" ? "PA" : "PM";
            return <div className={`build-exo-option ${diagnostic.status}`} key={exo}>
              <button className={`build-exo ${enabled ? "active" : ""}`} aria-pressed={enabled} aria-describedby={`exo-${exo}-reason`} aria-label={`+1 ${unit} exotique sur le stuff · ${statusLabel}`} onClick={() => onExo(exo, !enabled)}>
                <StatIcon stat={stat(exo)} /><span>+1 {unit} exotique<small>{statusLabel}</small></span>{enabled ? <Check size={14} /> : warning ? <AlertTriangle size={14} /> : <Plus size={14} />}
              </button>
              <p id={`exo-${exo}-reason`} className="build-exo-reason">{diagnostic.reasons[0] || (enabled ? "Objet au choix. Clique pour retirer cet exo." : `${fmt(diagnostic.before)} → ${fmt(diagnostic.after)} ${unit} · Objet au choix.`)}</p>
              {diagnostic.reasons.length > 1 && <details className="build-exo-more"><summary>Autres raisons ({diagnostic.reasons.length - 1})</summary><ul>{diagnostic.reasons.slice(1).map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>}
            </div>;
          })}
        </div>
        <p className="build-exo-limit">{exoCount} exo{exoCount > 1 ? "s" : ""} actif{exoCount > 1 ? "s" : ""} · Modification libre<br />Recherche : {maxExos} exo{maxExos > 1 ? "s" : ""} maximum, selon l’atelier</p>
        <div className="paperdoll">
          <div className="slots-column">
            {(["amulet", "ring1", "ring2", "weapon", "shield"] as Slot[]).map(
              renderSlot,
            )}
          </div>
          <div className="avatar-stage">
            <div className="essentials">
              {["actionPoints", "movementPoints", "range"].map((key) => (
                <span className="essential" key={key} title={`${stat(key)?.name || key} actuels`}>
                  <StatIcon stat={stat(key)} />
                  {fmt(stats[key] || 0)} <small>{key === "actionPoints" ? "PA" : key === "movementPoints" ? "PM" : "PO"}</small>
                </span>
              ))}
            </div>
            <div className="avatar-glow" />
            <CharacterPreview gameClass={currentClass} slots={evaluation.build.slots} />
            <div className="avatar-caption">
              {currentClass?.name}{" "}
              <small>Niveau {request.character.level}</small>
            </div>
          </div>
          <div className="slots-column">
            {(["hat", "cape", "belt", "boots", "pet"] as Slot[]).map(
              renderSlot,
            )}
          </div>
        </div>
        <div className="dofus-slots">
          {(
            [
              "dofus1",
              "dofus2",
              "dofus3",
              "dofus4",
              "dofus5",
              "dofus6",
            ] as Slot[]
          ).map(renderSlot)}
        </div>
        {(invalidCount > 0 || unverifiedCount > 0) && <div className="equipment-legend" aria-live="polite">
          {invalidCount > 0 && <span className="invalid"><AlertTriangle size={12} />{invalidCount} objet{invalidCount > 1 ? "s" : ""} incompatible{invalidCount > 1 ? "s" : ""}</span>}
          {unverifiedCount > 0 && <span className="unverified"><Info size={12} />{unverifiedCount} objet{unverifiedCount > 1 ? "s" : ""} à vérifier</span>}
          <small>Clique sur un objet pour voir pourquoi.</small>
        </div>}
        <div className="equipment-bottom">
          <small>
            {evaluation.cost === null
              ? `${evaluation.missingPrices.length + evaluation.missingExoPrices.length} prix à renseigner`
              : money(evaluation.cost)}
          </small>
          <button className="button small primary" onClick={onSpells}>
            <Swords size={13} /> Voir les dégâts
          </button>
        </div>
        {!!Object.keys(evaluation.maluses.stats).length && <details className="equipment-maluses">
          <summary><AlertTriangle size={14} /> Malus pris en compte dans la recherche</summary>
          <p>Ces pertes diminuent le classement du stuff, même sans objectif sur ces caractéristiques. Les bonus des autres objets restent inclus dans les totaux affichés.</p>
          <div className="malus-stats">{Object.entries(evaluation.maluses.stats).map(([key, value]) => <span key={key}>
            <StatIcon stat={stat(key)} /><span>{stat(key)?.name || key}</span><strong>{fmt(value)}{statUnit(stat(key))}</strong>
          </span>)}</div>
        </details>}
        {Object.keys(evaluation.build.slots).length > 0 && (
          <button
            className="button ghost small"
            style={{ marginTop: 10 }}
            onClick={onClear}
          >
            Retirer tous les objets
          </button>
        )}
      </section>
      <aside className="build-side">
        <BuildPrice catalog={catalog} build={evaluation.build} prices={request.prices} onPrices={onPrices} onSlot={onSlot} />
        <section className="panel equipment-compatibility">
          <h3><Shield size={14} /> Compatibilité du stuff</h3>
          <div className="equipment-limits">
            {(["actionPoints", "movementPoints"] as ExoStat[]).map((key) => {
              const limit = diagnostics.limits[key];
              const unit = key === "actionPoints" ? "PA" : "PM";
              return <div className="equipment-limit" key={key}>
                <div className="equipment-limit-heading"><StatIcon stat={stat(key)} /><strong>{fmt(limit.effective)} {unit}</strong>{limit.raw !== limit.effective && <small>{fmt(limit.raw)} équipés</small>}</div>
                <dl>
                  <div><dt>Plafond du jeu</dt><dd>{limit.cap} {unit}</dd></div>
                  {limit.equipmentMaximum !== null && <div className={limit.raw > limit.equipmentMaximum ? "failed" : ""}><dt>Maximum avec ces objets</dt><dd>{fmt(limit.equipmentMaximum)} {unit}</dd></div>}
                  {limit.strictMaximum !== null && <div className={limit.effective > limit.strictMaximum ? "failed" : ""}><dt>Ton maximum obligatoire</dt><dd>{fmt(limit.strictMaximum)} {unit}</dd></div>}
                </dl>
              </div>;
            })}
          </div>
          {mobilityConditions.length > 0 && <div className="equipment-mobility-conditions">
            <h4>Conditions PA / PM des objets</h4>
            {mobilityConditions.map((entry) => {
              if (!entry?.condition) return null;
              const item = catalog.items.find((candidate) => candidate.id === entry.itemId);
              return <button key={entry.slot} className={`equipment-rule ${entry.condition.satisfied === false ? "failed" : entry.condition.satisfied === null ? "unverified" : ""}`} onClick={() => onSlot(entry.slot, item)}>
                {entry.condition.satisfied === true ? <Check size={12} /> : <Info size={12} />}<span><strong>{item?.name || slotNames[entry.slot]}</strong>{entry.condition.text}</span><ChevronRight size={12} />
              </button>;
            })}
          </div>}
          {diagnostics.issues.length > 0 ? <div className="equipment-issues">{diagnostics.issues.map((issue, index) => <div className={`equipment-issue ${issue.severity}`} key={`${issue.code}-${index}`}><AlertTriangle size={13} /><div><p>{issue.message}</p>{issue.slots.length > 0 && <div className="equipment-issue-links">{issue.slots.map((slot) => {
            const item = catalog.items.find((entry) => entry.id === evaluation.build.slots[slot]);
            return item && <button key={slot} onClick={() => onSlot(slot, item)}>{item.name}<ArrowUpRight size={10} /></button>;
          })}</div>}</div></div>)}</div> : <p className="equipment-compatible"><Check size={12} /> Conditions d’équipement respectées.</p>}
          <p className="section-help equipment-limit-note">Limites pour tes caractéristiques actuelles. Les conditions des objets utilisent les totaux équipés avant les plafonds du jeu, exos compris.</p>
        </section>
        <section className="panel">
          <h3>Résistances & dommages</h3>
          <table className="resist-table">
            <thead>
              <tr>
                <th></th>
                {elements.map((element) => (
                  <th key={element}>
                    <StatIcon
                      stat={stat(
                        element === "neutral"
                          ? "neutralDamageBonus"
                          : keys[element],
                      )}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Do.</td>
                {elements.map((element) => (
                  <td key={element}>
                    {fmt(stats[`${element}DamageBonus`] || 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Rés.</td>
                {elements.map((element) => (
                  <td key={element}>
                    {fmt(stats[`${element}ElementReduction`] || 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Rés. %</td>
                {elements.map((element) => (
                  <td key={element}>
                    {fmt(stats[`${element}ElementResistPercent`] || 0)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h3>Bonus de panoplies</h3>
          <p className="character-rule" style={{ marginBottom: 12 }}>{fmt(stats.activeSetCount || 0)} panoplie(s) active(s). Une panoplie est comptée dès 2 objets équipés. Pour « bonus pano &lt; 2 », une seule panoplie peut être active.</p>
          {evaluation.sets.length ? (
            evaluation.sets.map((set) => (
              <div className="set-bonus" key={set.id}>
                <strong>
                  {set.name} <small>({set.count} objets)</small>
                </strong>
                {Object.entries(set.stats).map(([key, value]) => (
                  <div key={key}>
                    +{fmt(value)} {stat(key)?.name || key}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="section-help">
              Équipe plusieurs objets d’une même panoplie pour activer ses
              bonus.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Mes objectifs</h3>
          {request.constraints.length ? (
            request.constraints.map((criterion) => {
              const result = evaluation.constraints.find(
                (entry) => entry.id === criterion.id,
              );
              return (
                <div
                  key={criterion.id}
                  className={`constraint-check ${!result?.satisfied ? "failed" : ""}`}
                >
                  {result?.satisfied ? <Check size={12} /> : <Info size={12} />}
                  <span>{constraintName(catalog, criterion)}</span>
                  <b>
                    {result?.supported
                      ? criterion.kind === "price"
                        ? money(result.value)
                        : `${fmt(result.value)}${criterion.metric === "criticalChance" ? " %" : ""}`
                      : "À vérifier"}
                  </b>
                </div>
              );
            })
          ) : (
            <p className="section-help">Ajoute des critères dans l’atelier.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
