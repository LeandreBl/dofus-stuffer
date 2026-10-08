import type { Catalog, ExoStat, PriceBook } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";
import { priceSourceLabel } from "../../lib/prices";

export function ExoBudgetPanel({ catalog, prices, onPrices }: {
  catalog: Catalog;
  prices: PriceBook;
  onPrices: (changes: Partial<PriceBook>) => void;
}) {
  const effective = { ...prices.automaticExoCosts, ...prices.exoCosts };
  const change = (exo: ExoStat, value?: number) => {
    const exoCosts = { ...prices.exoCosts };
    if (value === undefined) delete exoCosts[exo];
    else exoCosts[exo] = value;
    onPrices({ exoCosts });
  };
  return (
    <section className="panel" style={{ marginTop: 23 }}>
      <div className="panel-head"><div><h2>Budget des exos</h2><p>Un supplément par bonus, sur l’objet de ton choix.</p></div></div>
      <div className="exo-market-grid">
        {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => {
          const unit = exo === "actionPoints" ? "PA" : "PM";
          const custom = prices.exoCosts?.[exo], automatic = prices.automaticExoCosts?.[exo];
          return (
            <div className="exo-market-card" key={exo}>
              <h3><StatIcon stat={catalog.stats.find((stat) => stat.key === exo)} /> +1 {unit} exotique</h3>
              <label className="field">Supplément estimé (kamas)
                <input type="number" min="0" aria-label={`Supplément exo ${unit} en kamas`} placeholder="Coût inconnu" value={effective[exo] ?? ""}
                  onChange={(event) => change(exo, event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)))} />
              </label>
              <p className="inline-notice">{priceSourceLabel(custom, automatic)}</p>
              {custom !== undefined && automatic !== undefined && <button className="button small ghost" onClick={() => change(exo)}>Reprendre le prix automatique · {fmt(automatic)} K</button>}
            </div>
          );
        })}
      </div>
      <p className="inline-notice">Ces suppléments s’ajoutent une seule fois au prix total du stuff. Effacer un prix personnalisé reprend le prix automatique, s’il est disponible.</p>
    </section>
  );
}
