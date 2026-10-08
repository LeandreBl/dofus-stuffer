import { LockKeyhole, UnlockKeyhole } from "lucide-react";

export function EquipmentLocks({ lockedCount, equippedCount, searching, onLockAll, onUnlockAll }: {
  lockedCount: number;
  equippedCount: number;
  searching: boolean;
  onLockAll: () => void;
  onUnlockAll: () => void;
}) {
  return (
    <div className="equipment-locks">
      <div className="equipment-locks-heading"><LockKeyhole size={14} /><strong aria-live="polite">
        {lockedCount ? `Base verrouillée · ${lockedCount} objet${lockedCount > 1 ? "s" : ""}` : "Conserver des pièces"}
      </strong></div>
      <p>{lockedCount ? "La recherche garde ces pièces et optimise les autres emplacements." : "Clique sur le cadenas des objets à garder, puis relance la recherche."}</p>
      <div className="equipment-locks-actions">
        {equippedCount > 0 && <button className="button ghost small" disabled={searching} onClick={onLockAll}><LockKeyhole size={12} />Tout verrouiller</button>}
        {lockedCount > 0 && <button className="button ghost small" disabled={searching} onClick={onUnlockAll}><UnlockKeyhole size={12} />Tout déverrouiller</button>}
      </div>
    </div>
  );
}
