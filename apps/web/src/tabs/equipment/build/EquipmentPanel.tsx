import { AlertTriangle, Info, Swords } from "lucide-react";
import type { BuildEvaluation, Catalog, EquipmentItem, ExoStat, inspectEquipment, OptimizationRequest, Slot } from "@dofus/shared";
import { money } from "../../../lib/format";
import { AvatarStage } from "./AvatarStage";
import { BuildExos } from "./BuildExos";
import { EquipmentLocks } from "./EquipmentLocks";
import { EquipmentMaluses } from "./EquipmentMaluses";
import { EquipmentSlot } from "./EquipmentSlot";

const leftSlots: Slot[] = ["amulet", "ring1", "ring2", "weapon", "shield"];
const rightSlots: Slot[] = ["hat", "cape", "belt", "boots", "pet"];
const dofusSlots: Slot[] = ["dofus1", "dofus2", "dofus3", "dofus4", "dofus5", "dofus6"];

/** The paperdoll: slots, character, locks, exos and the build cost. */
export function EquipmentPanel({ catalog, request, evaluation, diagnostics, searching, onSlot, onSpells, onClear, onExo, onLock, onLockAll, onUnlockAll }: {
  catalog: Catalog;
  request: OptimizationRequest;
  evaluation: BuildEvaluation;
  diagnostics: ReturnType<typeof inspectEquipment>;
  searching: boolean;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
  onSpells: () => void;
  onClear: () => void;
  onExo: (exo: ExoStat, enabled: boolean) => void;
  onLock: (slot: Slot) => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
}) {
  const lockedCount = Object.keys(request.filters.lockedSlots).length;
  const equippedCount = Object.keys(evaluation.build.slots).length;
  const items = Object.values(diagnostics.items);
  const invalidCount = items.filter((item) => item?.invalid).length;
  const unverifiedCount = items.filter((item) => !item?.invalid && item?.issues.some((issue) => issue.severity === "unknown")).length;
  const slot = (slot: Slot) => (
    <EquipmentSlot
      key={slot}
      slot={slot}
      item={catalog.items.find((entry) => entry.id === evaluation.build.slots[slot])}
      catalog={catalog}
      request={request}
      diagnostic={diagnostics.items[slot]}
      searching={searching}
      onSlot={onSlot}
      onLock={onLock}
    />
  );
  return (
    <section className="panel equipment-panel">
      <div className="equipment-title">
        <span>Ton équipement</span>
        <b>{equippedCount} / 16 objets</b>
      </div>
      {(equippedCount > 0 || lockedCount > 0) && <EquipmentLocks lockedCount={lockedCount} equippedCount={equippedCount} searching={searching} onLockAll={onLockAll} onUnlockAll={onUnlockAll} />}
      <BuildExos catalog={catalog} evaluation={evaluation} diagnostics={diagnostics} maxExos={request.filters.maxExos ?? 2} onExo={onExo} />
      <div className="paperdoll">
        <div className="slots-column">{leftSlots.map(slot)}</div>
        <AvatarStage catalog={catalog} character={request.character} stats={evaluation.stats} slots={evaluation.build.slots} />
        <div className="slots-column">{rightSlots.map(slot)}</div>
      </div>
      <div className="dofus-slots">{dofusSlots.map(slot)}</div>
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
      {!!Object.keys(evaluation.maluses.stats).length && <EquipmentMaluses catalog={catalog} maluses={evaluation.maluses.stats} />}
      {equippedCount > 0 && (
        <button className="button ghost small" style={{ marginTop: 10 }} onClick={onClear}>
          Retirer tous les objets
        </button>
      )}
    </section>
  );
}
