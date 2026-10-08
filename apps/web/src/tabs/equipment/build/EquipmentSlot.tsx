import { AlertTriangle, Crown, Diamond, Footprints, Info, LoaderCircle, LockKeyhole, Package, Shield, Swords, UnlockKeyhole } from "lucide-react";
import type { Catalog, EquipmentItem, inspectEquipment, OptimizationRequest, Slot } from "@dofus/shared";
import { GameImage } from "../../../components/GameImage";
import { ItemHover } from "../../../items/ItemHover";
import { slotNames } from "../../../items/slots";

type SlotDiagnostic = ReturnType<typeof inspectEquipment>["items"][Slot];

const slotIcon = (slot: Slot) =>
  slot === "hat" ? Crown
    : slot === "weapon" ? Swords
    : slot === "shield" ? Shield
    : slot === "boots" ? Footprints
    : slot.startsWith("dofus") ? Diamond
    : Package;

export function EquipmentSlot({ slot, item, catalog, request, diagnostic, searching, onSlot, onLock }: {
  slot: Slot;
  item?: EquipmentItem;
  catalog: Catalog;
  request: OptimizationRequest;
  diagnostic: SlotDiagnostic;
  searching: boolean;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
  onLock: (slot: Slot) => void;
}) {
  const Icon = slotIcon(slot);
  const unverified = diagnostic?.issues.some((issue) => issue.severity === "unknown");
  const reason = diagnostic?.issues.map((issue) => issue.message).join(" ");
  const condition = diagnostic?.condition?.text;
  const locked = !!item && request.filters.lockedSlots[slot] === item.id;
  const pending = searching && !locked ? "En cours de calcul : cet objet est susceptible de changer." : undefined;
  const description = [item?.name || slotNames[slot], pending, reason, condition ? `Condition : ${condition}` : undefined].filter(Boolean).join(" · ");
  return (
    <div className="equipment-slot-wrapper">
      <ItemHover item={item} catalog={catalog} request={request} issues={diagnostic?.issues.map((issue) => issue.message)} note={pending}><button
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
        {pending && <LoaderCircle className="spin corner-loader" size={11} aria-hidden="true" />}
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
