import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateBuild,
  getCharacterAllocation,
  type Build,
  type Catalog,
  type EquipmentItem,
  type PriceBook,
  type Slot,
} from "@dofus/shared";
import { ConstraintEditor } from "../constraints/ConstraintEditor";
import { ItemDetail } from "../items/ItemDetail";
import { chooseSlot } from "../items/slots";
import { manualBuildRequest } from "../lib/build-preview";
import { downloadJson, pickFile } from "../lib/files";
import { stuffFilename } from "../lib/class-slug";
import { urlParam } from "../lib/url";
import { BuilderTab } from "../tabs/builder/BuilderTab";
import { EquipmentTab } from "../tabs/equipment/EquipmentTab";
import { ItemsTab } from "../tabs/items/ItemsTab";
import { MarketTab } from "../tabs/market/MarketTab";
import { SpellsTab } from "../tabs/spells/SpellsTab";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { HelpModal } from "./HelpModal";
import { ItemBrowserModal } from "./ItemBrowserModal";
import { LaunchButton } from "./LaunchButton";
import { PageHeading } from "./PageHeading";
import { parseStuff } from "./profile-transfer";
import { initialState, saveWorkspace } from "./storage";
import { tabTitles } from "./tabs";
import { Toast } from "./Toast";
import type { JobSnapshot } from "@dofus/shared";
import { useCriterionEditor } from "./useCriterionEditor";
import { useNavigation } from "./useNavigation";
import { useOptimization } from "./useOptimization";
import { useToast } from "./useToast";
import { WorkspaceNotices } from "./WorkspaceNotices";

const statusTitles: Record<JobSnapshot["status"], string> = {
  running: "On explore les combinaisons",
  completed: "Recherche terminée",
  cancelled: "Recherche arrêtée",
  failed: "La recherche a rencontré un problème",
};

export function Workspace({ catalog }: { catalog: Catalog }) {
  const [initial] = useState(() => initialState(catalog));
  const [request, setRequest] = useState(initial.request);
  const [build, setBuild] = useState<Build>(initial.build);
  const [catalogUpdated, setCatalogUpdated] = useState(initial.catalogUpdated);
  const [exosUpdated, setExosUpdated] = useState(initial.exosUpdated);
  const [priceBooks, setPriceBooks] = useState<Record<string, PriceBook>>(initial.priceBooks);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [browser, setBrowser] = useState<{ slot?: Slot } | null>(null);
  const [itemSlot, setItemSlot] = useState<Slot | undefined>();
  // Bumped key remounts the catalog on the requested set.
  const [setLink, setSetLink] = useState<{ id: number; key: number }>();
  const { tab, setTab, item, setItem } = useNavigation(catalog);
  const [toast, notify] = useToast();
  const criteria = useCriterionEditor(request, setRequest, notify);
  const optimization = useOptimization({ catalog, setBuild });
  const { active } = optimization;
  const evaluation = useMemo(
    () => evaluateBuild(catalog, manualBuildRequest(request), build),
    [catalog, request, build],
  );
  const characterAllocation = getCharacterAllocation({ ...request.character, baseStats: request.character.allocationMode === "manual" ? request.character.baseStats : {} });
  const weapon = catalog.items.find((entry) => entry.id === build.slots.weapon);
  const equippedItemSlot = !item ? undefined : itemSlot
    ? (build.slots[itemSlot] === item.id ? itemSlot : undefined)
    : (Object.keys(build.slots) as Slot[]).find((slot) => build.slots[slot] === item.id);
  const closeBrowser = useCallback(() => setBrowser(null), []);
  const closeItem = useCallback(() => setItem(null), [setItem]);
  const closeHelp = useCallback(() => setHelp(false), []);

  useEffect(() => {
    setSaved(saveWorkspace(catalog, { request, build, priceBooks }));
  }, [request, build, priceBooks, catalog]);

  function changeServer(server: string) {
    setPriceBooks((previous) => ({ ...previous, [request.prices.server]: request.prices }));
    setRequest((previous) => ({
      ...previous,
      prices: priceBooks[server] || { server, values: {}, ownedItemIds: [], mode: "total" },
    }));
  }
  function equip(selected: EquipmentItem, requestedSlot?: Slot) {
    const slot = requestedSlot || chooseSlot(selected, build);
    const elsewhere = Object.entries(build.slots).some(([otherSlot, id]) => otherSlot !== slot && id === selected.id);
    if (selected.slotType === "ring" && selected.setId && elsewhere) {
      notify("Cet anneau de panoplie est déjà équipé. Choisis un autre anneau.");
      return;
    }
    if (selected.slotType === "dofus" && elsewhere) {
      notify("Ce Dofus ou trophée est déjà équipé.");
      return;
    }
    setBuild((previous) => ({ ...previous, slots: { ...previous.slots, [slot]: selected.id } }));
    setRequest((previous) => {
      const lockedSlots = { ...previous.filters.lockedSlots };
      if (lockedSlots[slot] && lockedSlots[slot] !== selected.id) delete lockedSlots[slot];
      return { ...previous, filters: { ...previous.filters, lockedSlots } };
    });
    setBrowser(null);
    notify(`${selected.name} équipé.`);
  }
  function unequip(slot: Slot) {
    setBuild((previous) => {
      const slots = { ...previous.slots };
      delete slots[slot];
      return { ...previous, slots };
    });
    setRequest((previous) => ({
      ...previous,
      filters: {
        ...previous.filters,
        lockedSlots: Object.fromEntries(Object.entries(previous.filters.lockedSlots).filter(([locked]) => locked !== slot)),
      },
    }));
    setItem(null);
    notify("Objet retiré du stuff.");
  }
  async function optimize() {
    if (optimization.starting || active) return;
    if (!characterAllocation.valid) {
      setError(characterAllocation.violations.join(" "));
      setTab("builder");
      return;
    }
    setError("");
    try {
      await optimization.start(request);
      setTab("equipment");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de démarrer la recherche.");
    }
  }
  async function stuffImport() {
    const file = await pickFile();
    if (!file) return;
    try {
      const imported = parseStuff(catalog, await file.text(), request.character);
      if (Object.keys(build.slots).length && !window.confirm("Remplacer ton stuff actuel par celui du fichier ?")) return;
      setBuild(imported.build);
      setTab("equipment");
      notify(imported.ignored ? `Stuff importé. ${imported.ignored} objet(s) absent(s) de ce catalogue ignoré(s).` : "Stuff importé.");
    } catch {
      setError("Ce fichier ne contient pas de stuff Dofus Stuffer valide.");
    }
  }
  const stuffExport = () =>
    downloadJson(stuffFilename(catalog, request, evaluation), {
      version: catalog.version,
      character: request.character,
      build,
      stats: evaluation.stats,
      constraints: request.constraints,
    });

  return (
    <>
      <AppHeader tab={tab} onTab={setTab} />
      <main className="workspace">
        <PageHeading title={tabTitles[tab]} onExport={stuffExport} onImport={() => void stuffImport()} onHelp={() => setHelp(true)} />
        <WorkspaceNotices
          catalog={catalog}
          error={error}
          catalogUpdated={catalogUpdated}
          exosUpdated={exosUpdated}
          onCloseError={() => setError("")}
          onCloseCatalog={() => setCatalogUpdated(false)}
          onCloseExos={() => setExosUpdated(false)}
        />
        {tab === "builder" && (
          <BuilderTab
            catalog={catalog}
            request={request}
            build={build}
            evaluation={evaluation}
            saved={saved}
            searching={active}
            onChange={setRequest}
            onServer={changeServer}
            onAdd={criteria.add}
            onEdit={criteria.edit}
            onBrowse={() => setBrowser({})}
            onFollow={() => setTab("equipment")}
          />
        )}
        {tab === "equipment" && (
          <EquipmentTab
            catalog={catalog}
            request={request}
            build={build}
            evaluation={evaluation}
            job={optimization.job}
            searching={active}
            starting={optimization.starting}
            selectedResult={optimization.selectedResult}
            setRequest={setRequest}
            setBuild={setBuild}
            notify={notify}
            onSelectResult={optimization.setSelectedResult}
            onSlot={(slot, selected) => {
              setItemSlot(slot);
              if (selected) setItem(selected);
              else setBrowser({ slot });
            }}
            onBrowse={() => setBrowser({})}
            onBuilder={() => setTab("builder")}
            onSpells={() => setTab("spells")}
            onPrices={() => setTab("market")}
          />
        )}
        {tab === "spells" && (
          <SpellsTab
            catalog={catalog}
            request={request}
            evaluation={evaluation}
            onChange={setRequest}
            onAdd={criteria.add}
            onWeapon={() => setBrowser({ slot: "weapon" })}
            initialSpellId={urlParam("spell")}
          />
        )}
        {tab === "items" && (
          <ItemsTab
            setLink={setLink}
            catalog={catalog}
            request={request}
            build={build}
            onChange={setRequest}
            onEquip={equip}
            onItem={(selected) => {
              setItemSlot(undefined);
              setItem(selected);
            }}
          />
        )}
        {tab === "market" && (
          <MarketTab
            catalog={catalog}
            request={request}
            onChange={setRequest}
            onServer={changeServer}
            notify={notify}
          />
        )}
      </main>
      <AppFooter catalog={catalog} />
      <LaunchButton
        starting={optimization.starting}
        active={active}
        disabled={request.constraints.length === 0 || !characterAllocation.valid}
        withBase={Object.keys(request.filters.lockedSlots).length > 0}
        percent={active ? optimization.job?.progress.percent : undefined}
        job={optimization.job}
        statusTitles={statusTitles}
        onLaunch={() => void optimize()}
        onCancel={() => void optimization.cancel()}
      />
      {criteria.editing && (
        <ConstraintEditor
          criterion={criteria.editing}
          constraints={request.constraints}
          catalog={catalog}
          characterLevel={request.character.level}
          stats={evaluation.stats}
          weapon={weapon}
          onSave={criteria.save}
          onClose={criteria.close}
        />
      )}
      {browser && (
        <ItemBrowserModal
          slot={browser.slot}
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
          onClose={closeBrowser}
        />
      )}
      {item && (
        <ItemDetail
          item={item}
          catalog={catalog}
          request={request}
          onChange={setRequest}
          onEquip={(selected) => equip(selected, itemSlot ?? equippedItemSlot)}
          onClose={closeItem}
          onSet={(id) => {
            setItem(null);
            setBrowser(null);
            setSetLink({ id, key: Date.now() });
            setTab("items");
          }}
          build={build}
          slot={itemSlot}
          onRemove={equippedItemSlot ? () => unequip(equippedItemSlot) : undefined}
          onReplace={equippedItemSlot ? () => {
            setItem(null);
            setBrowser({ slot: equippedItemSlot });
          } : undefined}
        />
      )}
      {help && <HelpModal onClose={closeHelp} />}
      {toast && <Toast message={toast} />}
      {optimization.finished && (
        <Toast className="search-done" message={optimization.job?.error || statusTitles[optimization.finished]} onClose={optimization.dismissFinished} />
      )}
    </>
  );
}
