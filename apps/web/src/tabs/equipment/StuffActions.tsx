import { Download, Package, SlidersHorizontal, Upload } from "lucide-react";

export function StuffActions({ onBrowse, onPriorities, onExport, onImport }: {
  onBrowse: () => void;
  onPriorities: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <div className="profile-actions">
      <button className="button" onClick={onBrowse}>
        <Package size={14} /> Parcourir les équipements
      </button>
      <button className="button ghost" onClick={onPriorities}>
        <SlidersHorizontal size={14} /> Ajuster mes priorités
      </button>
      <button className="button ghost" onClick={onExport}>
        <Download size={14} /> Exporter mon stuff
      </button>
      <button className="button ghost" onClick={onImport}>
        <Upload size={14} /> Importer un stuff
      </button>
    </div>
  );
}
