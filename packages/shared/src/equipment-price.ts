import type { EquipmentItem, ExoStat, PriceBook } from './types.js';

function validPrice(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function itemPrice(prices: PriceBook, id: number): number | null {
  return validPrice(prices.values[String(id)] ?? prices.automaticValues?.[String(id)]);
}

export function exoPrice(prices: PriceBook, exo: ExoStat): number | null {
  return validPrice(prices.exoCosts?.[exo] ?? prices.automaticExoCosts?.[exo]);
}

/** Prices are per equipped copy. Missing observations never become free items. */
export function calculateEquipmentPrice(items: readonly Pick<EquipmentItem, 'id'>[], exoBonuses: readonly ExoStat[], prices: PriceBook) {
  const missingPrices: number[] = [];
  const missingExoPrices: string[] = [];
  let equipmentCost = 0, exoCost = 0;
  for (const item of items) {
    if (prices.mode === 'remaining' && prices.ownedItemIds.includes(item.id)) continue;
    const value = itemPrice(prices, item.id);
    if (value === null) missingPrices.push(item.id);
    else equipmentCost += value;
  }
  for (const exo of exoBonuses) {
    if (prices.mode === 'remaining' && prices.ownedExos?.includes(exo)) continue;
    const value = exoPrice(prices, exo);
    if (value === null) missingExoPrices.push(exo === 'actionPoints' ? 'pa' : 'pm');
    else exoCost += value;
  }
  const knownCost = equipmentCost + exoCost;
  return { cost: missingPrices.length || missingExoPrices.length ? null : knownCost,
    knownCost, equipmentCost, exoCost, missingPrices, missingExoPrices };
}
