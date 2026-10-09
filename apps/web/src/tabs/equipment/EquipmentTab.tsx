import type { Dispatch, SetStateAction } from "react";
import { Info, Package } from "lucide-react";
import type { Build, BuildEvaluation, Catalog, EquipmentItem, JobSnapshot, OptimizationRequest, Slot } from "@dofus/shared";
import { withEquipmentLocks } from "../../lib/equipment-locks";
import { BuildChecks } from "./BuildChecks";
import { BuildView } from "./build/BuildView";
import { ResultTabs } from "./ResultTabs";
import { StuffActions } from "./StuffActions";

export function EquipmentTab({
  catalog, request, build, evaluation, job, searching, starting, selectedResult,
  setRequest, setBuild, notify, onSelectResult, onSlot, onBrowse, onBuilder, onSpells, onPrices,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  evaluation: BuildEvaluation;
  job: JobSnapshot | null;
  /** A search is running. */
  searching: boolean;
  starting: boolean;
  selectedResult: number;
  setRequest: Dispatch<SetStateAction<OptimizationRequest>>;
  setBuild: Dispatch<SetStateAction<Build>>;
  notify: (message: string) => void;
  onSelectResult: (index: number) => void;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
  onBrowse: () => void;
  onBuilder: () => void;
  onSpells: () => void;
  onPrices: () => void;
}) {
  const equipped = Object.keys(build.slots).length > 0;
  const lock = (slot: Slot) => {
    const id = build.slots[slot];
    if (!id || starting || searching) return;
    setRequest((previous) => {
      const lockedSlots = { ...previous.filters.lockedSlots };
      if (lockedSlots[slot] === id) delete lockedSlots[slot];
      else lockedSlots[slot] = id;
      return withEquipmentLocks(previous, catalog, lockedSlots);
    });
  };
  return (
    <>
      {!!job?.results.length && (
        <ResultTabs
          results={job.results}
          lockedSlots={request.filters.lockedSlots}
          selected={selectedResult}
          searching={searching}
          onSelect={(index, result) => {
            onSelectResult(index);
            setBuild(result.build);
          }}
        />
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
      {!equipped && !searching && (
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
        onSlot={onSlot}
        onSpells={onSpells}
        onPrices={onPrices}
        onClear={() => {
          setBuild((previous) => ({ ...previous, slots: {} }));
          setRequest((previous) => withEquipmentLocks(previous, catalog, {}));
          notify("Tous les objets ont été retirés du mannequin.");
        }}
        onLock={lock}
        onLockAll={() => setRequest((previous) => withEquipmentLocks(previous, catalog, build.slots))}
        onUnlockAll={() => setRequest((previous) => withEquipmentLocks(previous, catalog, {}))}
        searching={starting || searching}
        actions={
          <StuffActions
            onBrowse={onBrowse}
            onPriorities={onBuilder}
          />
        }
        onExo={(exo, enabled) => {
          setBuild((previous) => ({ ...previous, exoBonuses: enabled ? [...new Set([...(previous.exoBonuses || []), exo])] : (previous.exoBonuses || []).filter((value) => value !== exo) }));
        }}
      />
      <BuildChecks evaluation={evaluation} equipped={equipped} />
    </>
  );
}
