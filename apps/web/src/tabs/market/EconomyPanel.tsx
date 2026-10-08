import { Coins, Info } from "lucide-react";
import type { Catalog, PriceBook } from "@dofus/shared";
import { ServerSelect } from "../../components/ServerSelect";
import type { PriceSyncState } from "../../lib/api";

export function EconomyPanel({ catalog, prices, priceSync, knownCount, onServer }: {
  catalog: Catalog;
  prices: PriceBook;
  priceSync: PriceSyncState;
  knownCount: number;
  onServer: (server: string) => void;
}) {
  const syncStatus = priceSync.server !== prices.server ? "loading"
    : priceSync.configured === false ? "unconfigured" : priceSync.status;
  const hasAutomaticPrices = Object.keys(prices.automaticValues || {}).length > 0 || Object.keys(prices.automaticExoCosts || {}).length > 0;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <Coins size={17} /> Mon économie
        </h2>
        <span className="counter">{knownCount} prix d’objets connus</span>
      </div>
      <label className="field">
        Serveur
        <ServerSelect catalog={catalog} server={prices.server} onChange={onServer} />
      </label>
      <div className="notice">
        <Info size={16} />
        <div>
          {syncStatus === "loading" ? "Vérification des prix de ce serveur…"
            : syncStatus === "available" ? "Les prix disponibles sont synchronisés automatiquement pour ce serveur. Tes prix personnalisés restent prioritaires."
            : syncStatus === "unconfigured" ? "Aucune source de prix automatique n’est configurée. Tu peux renseigner ou importer tes relevés par serveur."
            : "Les prix automatiques sont momentanément indisponibles pour ce serveur."}
          {syncStatus !== "available" && hasAutomaticPrices && " Les derniers prix enregistrés sont conservés."}
          {" "}Un prix inconnu reste inconnu pendant l’optimisation.
        </div>
      </div>
      {prices.automaticUpdatedAt && <p className="inline-notice">Dernier relevé automatique : {new Date(prices.automaticUpdatedAt).toLocaleString("fr-FR")}{prices.automaticSource ? ` · ${prices.automaticSource}` : ""}.</p>}
      {priceSync.server === prices.server && priceSync.lastCheck?.status === "error" && <p className="inline-notice">La dernière actualisation a échoué. Les derniers prix disponibles restent utilisés.</p>}
      <p className="inline-notice">
        {prices.updatedAt
          ? `Dernière modification personnelle : ${new Date(prices.updatedAt).toLocaleString("fr-FR")}`
          : "Aucun prix personnalisé pour ce serveur."}{" "}
        · Prix pour les jets maximums du catalogue, auxquels s’ajoutent les suppléments exotiques choisis.
      </p>
    </section>
  );
}
