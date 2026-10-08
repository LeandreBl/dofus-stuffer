import { useCallback, useEffect, useState } from "react";
import type { Catalog, EquipmentItem } from "@dofus/shared";
import { setUrlParam, urlParam } from "../lib/url";
import { tabFromPath, tabPaths, type Tab } from "./tabs";

/** Current tab and opened item, kept in sync with the URL and the browser history. */
export function useNavigation(catalog: Catalog) {
  const [tab, setTabState] = useState<Tab>(() => tabFromPath(location.pathname));
  // Push before rendering so views can write their own ?spell= on the new entry.
  const setTab = useCallback((next: Tab) => {
    if (tabFromPath(location.pathname) !== next) history.pushState(null, "", tabPaths[next]);
    setTabState(next);
  }, []);
  const [item, setItem] = useState<EquipmentItem | null>(() => catalog.items.find((entry) => entry.id === urlParam("item")) ?? null);
  useEffect(() => setUrlParam("item", item?.id), [item, tab]);
  useEffect(() => {
    const sync = () => {
      setTabState(tabFromPath(location.pathname));
      setItem(catalog.items.find((entry) => entry.id === urlParam("item")) ?? null);
    };
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, [catalog]);
  return { tab, setTab, item, setItem };
}
