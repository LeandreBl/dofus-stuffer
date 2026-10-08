import { useState } from "react";
import { Search } from "lucide-react";
import type { Catalog, PriceBook } from "@dofus/shared";
import { SearchField } from "../../components/SearchField";
import { fmt } from "../../lib/format";
import { ItemPriceCard } from "./ItemPriceCard";

const PAGE = 24;

export function ItemPricesPanel({ catalog, prices, effectiveValues, onPrices }: {
  catalog: Catalog;
  prices: PriceBook;
  effectiveValues: PriceBook["values"];
  onPrices: (changes: Partial<PriceBook>) => void;
}) {
  const [search, setSearch] = useState("");
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const items = catalog.items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (!onlyKnown || effectiveValues[String(item.id)] !== undefined),
  );
  const changePrice = (key: string, price?: number) => {
    const values = { ...prices.values };
    if (price === undefined) delete values[key];
    else values[key] = price;
    onPrices({ values });
  };
  return (
    <section className="panel" style={{ marginTop: 23 }}>
      <div className="panel-head market-price-head">
        <h2>Prix des objets</h2>
        <button
          className={`button small ${onlyKnown ? "primary" : "ghost"}`}
          onClick={() => {
            setOnlyKnown((value) => !value);
            setLimit(PAGE);
          }}
        >
          {onlyKnown ? "Prix renseignés" : "Tous les objets"}
        </button>
      </div>
      <SearchField
        value={search}
        onChange={(value) => {
          setSearch(value);
          setLimit(PAGE);
        }}
        placeholder="Rechercher un objet pour renseigner son prix…"
      />
      <div className="items-grid">
        {items.slice(0, limit).map((item) => {
          const key = String(item.id);
          return (
            <ItemPriceCard
              key={item.id}
              item={item}
              custom={prices.values[key]}
              automatic={prices.automaticValues?.[key]}
              onChange={(price) => changePrice(key, price)}
            />
          );
        })}
      </div>
      {!items.length && (
        <div className="empty-state">
          <Search size={23} />
          <p>{onlyKnown ? "Aucun prix renseigné pour cette recherche." : "Aucun objet trouvé."}</p>
        </div>
      )}
      {items.length > limit && (
        <button className="button ghost more-button" onClick={() => setLimit((value) => value + 36)}>
          Afficher plus d’objets
        </button>
      )}
      <p className="pagination-summary">
        {Math.min(limit, items.length)} / {fmt(items.length)} objets
      </p>
    </section>
  );
}
