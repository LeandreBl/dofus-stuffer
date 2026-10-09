import { Package, SlidersHorizontal } from "lucide-react";

export function StuffActions({ onBrowse, onPriorities }: {
  onBrowse: () => void;
  onPriorities: () => void;
}) {
  return (
    <div className="profile-actions">
      <button className="button" onClick={onBrowse}>
        <Package size={14} /> Parcourir les équipements
      </button>
      <button className="button ghost" onClick={onPriorities}>
        <SlidersHorizontal size={14} /> Ajuster mes priorités
      </button>
    </div>
  );
}
