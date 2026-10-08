import type { Catalog, OptimizationRequest, PriceBook } from "@dofus/shared";
import type { MaintenanceStatus, PriceSyncState } from "../../lib/api";
import { EconomyPanel } from "./EconomyPanel";
import { ExoBudgetPanel } from "./ExoBudgetPanel";
import { ItemPricesPanel } from "./ItemPricesPanel";
import { MaintenancePanel } from "./MaintenancePanel";
import { PriceImportPanel } from "./PriceImportPanel";

export function MarketTab({
  catalog,
  request,
  priceSync,
  maintenance,
  onChange,
  onServer,
  notify,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  priceSync: PriceSyncState;
  maintenance: MaintenanceStatus | null;
  onChange: (request: OptimizationRequest) => void;
  onServer: (server: string) => void;
  notify: (message: string) => void;
}) {
  const prices = request.prices;
  const effectiveValues = { ...prices.automaticValues, ...prices.values };
  const effectiveExoCosts = { ...prices.automaticExoCosts, ...prices.exoCosts };
  const changePrices = (changes: Partial<PriceBook>) =>
    onChange({ ...request, prices: { ...prices, ...changes, updatedAt: new Date().toISOString() } });
  return (
    <>
      <div className="market-grid">
        <EconomyPanel catalog={catalog} prices={prices} priceSync={priceSync} knownCount={Object.keys(effectiveValues).length} onServer={onServer} />
        <PriceImportPanel catalog={catalog} prices={prices} effectivePrices={{ values: effectiveValues, exoCosts: effectiveExoCosts }} onPrices={changePrices} notify={notify} />
      </div>
      {maintenance && <MaintenancePanel maintenance={maintenance} />}
      <ExoBudgetPanel catalog={catalog} prices={prices} onPrices={changePrices} />
      <ItemPricesPanel catalog={catalog} prices={prices} effectiveValues={effectiveValues} onPrices={changePrices} />
    </>
  );
}
