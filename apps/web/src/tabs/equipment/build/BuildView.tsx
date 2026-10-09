import { useMemo, type ReactNode } from "react";
import { inspectEquipment, type BuildEvaluation, type Catalog, type EquipmentItem, type ExoStat, type OptimizationRequest, type Slot } from "@dofus/shared";
import { manualBuildRequest } from "../../../lib/build-preview";
import { ActiveSetsPanel } from "./ActiveSetsPanel";
import { BaseStatsTable } from "./BaseStatsTable";
import { BuildPrice } from "./BuildPrice";
import { CompatibilityPanel } from "./CompatibilityPanel";
import { EquipmentPanel } from "./EquipmentPanel";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { ResistancesPanel } from "./ResistancesPanel";
import { StatsPanel } from "./StatsPanel";

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
  actions,
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
  actions?: ReactNode;
}) {
  const diagnostics = useMemo(() => inspectEquipment(catalog, manualBuildRequest(request), evaluation), [catalog, request, evaluation]);
  return (
    <div className="build-layout">
      <aside className="build-side">
        <StatsPanel
          title="Caractéristiques essentielles"
          className="build-essential-stats"
          labelled
          catalog={catalog}
          stats={evaluation.stats}
          keys={["hitPoints", "actionPoints", "movementPoints", "range", "maxSummonedCreaturesBoost", "criticalHit", "damagePercent"]}
        />
        <BaseStatsTable catalog={catalog} character={request.character} evaluation={evaluation} />
        <StatsPanel
          title="Caractéristiques secondaires"
          catalog={catalog}
          stats={evaluation.stats}
          keys={["initiative", "magicFind", "healBonus", "allDamageBonus", "criticalDamageBonus", "tackleEvade", "tackleBlock"]}
        />
      </aside>
      <div className="build-main">
        <EquipmentPanel
          catalog={catalog}
          request={request}
          evaluation={evaluation}
          diagnostics={diagnostics}
          searching={searching}
          onSlot={onSlot}
          onSpells={onSpells}
          onClear={onClear}
          onExo={onExo}
          onLock={onLock}
          onLockAll={onLockAll}
          onUnlockAll={onUnlockAll}
        />
        {actions}
      </div>
      <aside className="build-side">
        <ObjectivesPanel catalog={catalog} constraints={request.constraints} evaluation={evaluation} />
        <CompatibilityPanel catalog={catalog} build={evaluation.build} diagnostics={diagnostics} onSlot={onSlot} />
        <ResistancesPanel catalog={catalog} stats={evaluation.stats} />
        <ActiveSetsPanel catalog={catalog} evaluation={evaluation} />
        <BuildPrice catalog={catalog} build={evaluation.build} prices={request.prices} onPrices={onPrices} onSlot={onSlot} />
      </aside>
    </div>
  );
}
