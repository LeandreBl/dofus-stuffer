import { useMemo, useState } from "react";
import { Check, CircleSlash, Package, Shield } from "lucide-react";
import { slotType, type Build, type Catalog, type EquipmentItem, type OptimizationRequest, type Slot } from "@dofus/shared";
import { searchable } from "../../lib/format";
import { BrowserToolbar, type BrowserFilters } from "./BrowserToolbar";
import { isExcluded, toggleExcluded, toggleLock, toggleTypeExclusion } from "./filter-actions";
import { ItemCard } from "./ItemCard";
import { MoreButton } from "../../components/MoreButton";
import { SetCard } from "./SetCard";
import { setEntries } from "./set-entries";
import { StatFilterChips } from "./StatFilterChips";
import { StatFilterPanel } from "./StatFilterPanel";

const PAGE = 36;

export function ItemBrowser({
  catalog,
  request,
  build,
  onChange,
  onEquip,
  onItem,
  slot,
  initialSetId,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  onChange: (request: OptimizationRequest) => void;
  onEquip: (item: EquipmentItem, slot?: Slot) => void;
  onItem: (item: EquipmentItem) => void;
  slot?: Slot;
  initialSetId?: number;
}) {
  const [view, setView] = useState<"items" | "sets">(initialSetId ? "sets" : "items");
  // A set reached from an item's "Panoplie …" link is pinned until the search changes.
  const [focusedSetId, setFocusedSetId] = useState(initialSetId);
  const [filters, setFilters] = useState<BrowserFilters>({
    search: "", typeId: "all", visibility: "all", minLevel: "1", maxLevel: String(request.character.level), statKeys: [],
  });
  const [statsOpen, setStatsOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const changeFilters = (changes: Partial<BrowserFilters>) => {
    setFilters((current) => ({ ...current, ...changes }));
    if (changes.search !== undefined) setFocusedSetId(undefined);
    setLimit(PAGE);
  };
  const { search, typeId, visibility, statKeys } = filters;
  const minLevel = Number(filters.minLevel) || 1, maxLevel = Number(filters.maxLevel) || 200;
  const relevant = useMemo(
    () => catalog.items.filter((item) => !slot || item.slotType === slotType(slot)),
    [catalog, slot],
  );
  const sets = useMemo(() => setEntries(catalog), [catalog]);
  const visibleSets = focusedSetId ? sets.filter((entry) => entry.set.id === focusedSetId) : sets.filter((entry) =>
    (!slot || entry.members.some((item) => item.slotType === slotType(slot))) &&
    entry.level >= minLevel &&
    entry.level <= maxLevel &&
    statKeys.every((key) => (entry.totals[key] ?? 0) > 0) &&
    [entry.set.name, ...entry.members.map((item) => item.name)].some((name) => searchable(name).includes(searchable(search))),
  );
  if (statKeys.length) visibleSets.sort((a, b) => (b.totals[statKeys[0]] ?? 0) - (a.totals[statKeys[0]] ?? 0));
  const openSet = (id: number) => { setView("sets"); setFocusedSetId(id); setLimit(PAGE); };
  const types = Array.from(new Map(relevant.map((item) => [item.typeId, item.typeName])).entries())
    .sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const lockedIds = Object.values(request.filters.lockedSlots);
  const items = relevant.filter(
    (item) =>
      item.level >= minLevel &&
      item.level <= maxLevel &&
      statKeys.every((key) => (item.stats[key] ?? 0) > 0) &&
      (typeId === "all" || String(item.typeId) === typeId) &&
      searchable(item.name).includes(searchable(search)) &&
      (visibility === "all" ||
        (visibility === "excluded" && request.filters.excludedItemIds.includes(item.id)) ||
        (visibility === "locked" && lockedIds.includes(item.id))),
  );
  if (statKeys.length) items.sort((a, b) => (b.stats[statKeys[0]] ?? 0) - (a.stats[statKeys[0]] ?? 0));
  const typeExcluded = request.filters.excludedTypeIds.includes(Number(typeId));
  return (
    <>
      <div className="category-tabs" role="group" aria-label="Afficher">
        {([["items", "Objets"], ["sets", "Panoplies"]] as const).map(([id, label]) => (
          <button key={id} className={view === id ? "active" : ""} aria-pressed={view === id} onClick={() => { setView(id); setFocusedSetId(undefined); setLimit(PAGE); }}>{label}</button>
        ))}
      </div>
      <BrowserToolbar filters={filters} types={types} showItemFilters={view === "items"} statsOpen={statsOpen} onChange={changeFilters} onToggleStats={() => setStatsOpen(!statsOpen)} />
      {statsOpen && (
        <StatFilterPanel
          catalog={catalog}
          items={relevant}
          statKeys={statKeys}
          onToggle={(key) => changeFilters({ statKeys: statKeys.includes(key) ? statKeys.filter((value) => value !== key) : [...statKeys, key] })}
        />
      )}
      {!!statKeys.length && <StatFilterChips catalog={catalog} statKeys={statKeys} onChange={(keys) => setFilters((current) => ({ ...current, statKeys: keys }))} />}
      {view === "sets" ? <>
        {focusedSetId && <button className="button small ghost" onClick={() => setFocusedSetId(undefined)}>Toutes les panoplies</button>}
        <div className="items-grid">
          {visibleSets.slice(0, limit).map((entry) => (
            <SetCard key={entry.set.id} entry={entry} catalog={catalog} request={request} build={build} statKeys={statKeys} onItem={onItem} />
          ))}
        </div>
        {!visibleSets.length && <div className="empty-state"><Shield size={22} /><p>Aucune panoplie trouvée pour ces filtres et ce niveau.</p></div>}
        <MoreButton shown={limit} total={visibleSets.length} label="Afficher plus de panoplies" summary="panoplies" onMore={() => setLimit((value) => value + 48)} />
      </> : <>
        {typeId !== "all" && (
          <button className="button small ghost" onClick={() => onChange(toggleTypeExclusion(request, Number(typeId)))}>
            {typeExcluded ? <Check size={13} /> : <CircleSlash size={13} />}
            {typeExcluded ? "Réautoriser ce type entier" : "Exclure ce type entier"}
          </button>
        )}
        <div className="items-grid">
          {items.slice(0, limit).map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              catalog={catalog}
              request={request}
              excluded={isExcluded(request, item)}
              locked={slot ? request.filters.lockedSlots[slot] === item.id : lockedIds.includes(item.id)}
              statKeys={statKeys}
              preview={!slot}
              onOpen={() => onItem(item)}
              onSet={openSet}
              onExclude={() => onChange(toggleExcluded(request, item))}
              onLock={() => onChange(toggleLock(request, build, item, slot))}
              onEquip={() => onEquip(item, slot)}
            />
          ))}
        </div>
        {!items.length && (
          <div className="empty-state">
            <Package size={22} />
            <p>Aucun objet trouvé pour ces filtres et ce niveau.</p>
          </div>
        )}
        <MoreButton shown={limit} total={items.length} label="Afficher plus d’objets" summary="objets · jets maximums du catalogue" onMore={() => setLimit((value) => value + 48)} />
      </>}
    </>
  );
}
