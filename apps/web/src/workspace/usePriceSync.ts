import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { EquipmentItem, OptimizationRequest } from "@dofus/shared";
import { api, type PriceSyncState } from "../lib/api";

const validPrice = (price: unknown): price is number => typeof price === "number" && Number.isFinite(price) && price >= 0 && price <= 1_000_000_000_000;

/** Polls the automatic prices of the selected server every 5 minutes and stores them in the request. */
export function usePriceSync(server: string, items: EquipmentItem[], setRequest: Dispatch<SetStateAction<OptimizationRequest>>) {
  const [priceSync, setPriceSync] = useState<PriceSyncState>({ server, status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const knownIds = new Set(items.map((item) => String(item.id)));
    let active = true;
    let pending = false;
    setPriceSync({ server, status: "loading" });
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const feed = await api.prices(server, controller.signal);
        if (!active || feed.server !== server) return;
        setPriceSync({ server, status: feed.status, configured: feed.configured, lastCheck: feed.lastCheck });
        if (feed.status !== "available") return;
        const automaticValues = Object.fromEntries(Object.entries(feed.values).filter(([id, price]) => knownIds.has(id) && validPrice(price)));
        const automaticExoCosts = Object.fromEntries(Object.entries(feed.exoCosts || {}).filter(([key, price]) => ["actionPoints", "movementPoints"].includes(key) && validPrice(price)));
        setRequest((previous) => previous.prices.server !== server ? previous : ({
          ...previous,
          prices: { ...previous.prices, automaticValues, automaticExoCosts, automaticUpdatedAt: feed.updatedAt, automaticSource: feed.source },
        }));
      } catch {
        if (active) setPriceSync({ server, status: "error" });
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [server, items, setRequest]);
  return priceSync;
}
