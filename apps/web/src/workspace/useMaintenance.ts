import { useEffect, useState } from "react";
import { api, type MaintenanceStatus } from "../lib/api";

/** Data maintenance report, refreshed every 5 minutes. */
export function useMaintenance() {
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const refresh = () => api.maintenance(controller.signal).then((status) => {
      if (active) setMaintenance(status);
    }).catch(() => { /* Keep the previous successful maintenance report. */ });
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, []);
  return maintenance;
}
