import { useEffect, useState } from "react";
import type { Catalog } from "@dofus/shared";
import { api } from "./lib/api";
import { CatalogStatus } from "./workspace/CatalogStatus";
import { Workspace } from "./workspace/Workspace";

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    api
      .catalog()
      .then((value) => {
        if (!cancelled) setCatalog(value);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Le catalogue est indisponible.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  if (!catalog) return <CatalogStatus error={error} onRetry={() => setAttempt((value) => value + 1)} />;
  return <Workspace catalog={catalog} />;
}
