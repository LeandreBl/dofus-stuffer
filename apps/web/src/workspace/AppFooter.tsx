import type { Catalog } from "@dofus/shared";
import { fmt } from "../lib/format";

export function AppFooter({ catalog }: { catalog: Catalog }) {
  return (
    <footer className="app-footer">
      <span>
        <span className="online-dot" /> Catalogue {catalog.version} ·{" "}
        {fmt(catalog.items.length)} objets · {fmt(catalog.spells.length)}{" "}
        sorts
      </span>
      <span>
        Projet indépendant · Données et visuels © Ankama
      </span>
    </footer>
  );
}
