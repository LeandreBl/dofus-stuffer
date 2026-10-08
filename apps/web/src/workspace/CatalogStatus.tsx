import { Info, LoaderCircle, RotateCcw } from "lucide-react";

/** Full-page state while the catalog loads, or why it could not. */
export function CatalogStatus({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="loading-screen">
      {error ? (
        <div className="empty-state" style={{ maxWidth: 520 }}>
          <Info size={24} />
          <h3>Le catalogue n’est pas encore disponible</h3>
          <p>{error}</p>
          <p>Vérifie que l’application et ses services sont démarrés.</p>
          <button className="button primary" onClick={onRetry}>
            <RotateCcw size={14} /> Réessayer
          </button>
        </div>
      ) : (
        <>
          <LoaderCircle className="spin" size={23} />
          <span>Ouverture de ton atelier…</span>
        </>
      )}
    </div>
  );
}
