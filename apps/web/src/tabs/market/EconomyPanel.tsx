import { Coins, Info } from "lucide-react";
import type { Catalog, PriceBook } from "@dofus/shared";
import { ServerSelect } from "../../components/ServerSelect";

export function EconomyPanel({ catalog, prices, knownCount, onServer }: {
  catalog: Catalog;
  prices: PriceBook;
  knownCount: number;
  onServer: (server: string) => void;
}) {
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
          Renseigne ou importe tes relevés de prix par serveur. Un prix inconnu reste inconnu pendant l’optimisation.
        </div>
      </div>
      <p className="inline-notice">
        {prices.updatedAt
          ? `Dernière modification personnelle : ${new Date(prices.updatedAt).toLocaleString("fr-FR")}`
          : "Aucun prix personnalisé pour ce serveur."}{" "}
        · Prix pour les jets maximums du catalogue, auxquels s’ajoutent les suppléments exotiques choisis.
      </p>
    </section>
  );
}
