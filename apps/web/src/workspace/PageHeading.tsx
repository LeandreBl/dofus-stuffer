import { CircleHelp, Download, Upload } from "lucide-react";

export function PageHeading({ title, onExport, onImport, onHelp }: {
  title: string;
  onExport: () => void;
  onImport: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="heading-aside">
        <button className="button ghost" onClick={onExport}>
          <Download size={14} /> Exporter mon stuff
        </button>
        <button className="button ghost" onClick={onImport}>
          <Upload size={14} /> Importer un stuff
        </button>
        <button className="icon-button" onClick={onHelp} aria-label="Guide rapide">
          <CircleHelp size={19} />
        </button>
      </div>
    </div>
  );
}
