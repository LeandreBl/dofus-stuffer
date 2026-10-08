import { Info, X } from "lucide-react";
import type { Catalog } from "@dofus/shared";

/** Error, update notices and catalog notes shown above every tab. */
export function WorkspaceNotices({ catalog, error, catalogUpdated, exosUpdated, onCloseError, onCloseCatalog, onCloseExos }: {
  catalog: Catalog;
  error: string;
  catalogUpdated: boolean;
  exosUpdated: boolean;
  onCloseError: () => void;
  onCloseCatalog: () => void;
  onCloseExos: () => void;
}) {
  return (
    <>
      {error && (
        <div className="notice error page-notice" role="alert">
          <Info size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button className="icon-button" aria-label="Fermer l’erreur" onClick={onCloseError}>
            <X size={14} />
          </button>
        </div>
      )}
      {catalogUpdated && <div className="notice page-notice" role="status"><Info size={16} /><span>Le catalogue a changé depuis ta dernière recherche. Ton stuff est recalculé avec les règles actuelles. Relance une recherche pour obtenir de nouveaux résultats.</span><button className="icon-button" aria-label="Fermer l’information de mise à jour" onClick={onCloseCatalog}><X size={14} /></button></div>}
      {exosUpdated && <div className="notice page-notice" role="status"><Info size={16} /><span>Les exos s’appliquent maintenant au stuff, avec l’objet au choix. Tes objets et ta répartition sont conservés. Renseigne leurs suppléments dans Marché ; les anciens prix d’objets FM ne permettent pas de les déduire. Relance une recherche pour actualiser les résultats.</span><button className="icon-button" aria-label="Fermer l’information sur les exos" onClick={onCloseExos}><X size={14} /></button></div>}
      {!!catalog.warnings?.length && <details className="catalog-notes">
        <summary><Info size={13} /> Catalogue {catalog.version} · informations sur les données</summary>
        <div><p>Importé le {new Date(catalog.fetchedAt).toLocaleString("fr-FR")}. Les valeurs affichées et les recherches utilisent cette version.</p><ul>{catalog.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>
      </details>}
    </>
  );
}
