import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Catalog, PriceBook } from "@dofus/shared";
import { downloadJson } from "../../lib/files";
import { parsePriceImport } from "./price-import";

export function PriceImportPanel({ catalog, prices, effectivePrices, onPrices, notify }: {
  catalog: Catalog;
  prices: PriceBook;
  /** Custom and automatic prices merged, as exported. */
  effectivePrices: Pick<PriceBook, "values" | "exoCosts">;
  onPrices: (changes: Partial<PriceBook>) => void;
  notify: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function importPrices(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("Le fichier dépasse 2 Mo.");
      const content = await file.text();
      const { values, exoCosts } = parsePriceImport(content, file.name.toLowerCase().endsWith(".json") ? "json" : "csv", catalog, prices.server);
      onPrices({ values: { ...prices.values, ...values }, exoCosts: { ...prices.exoCosts, ...exoCosts } });
      notify(`${Object.keys(values).length + Object.keys(exoCosts).length} prix importés pour ${prices.server}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de lire ce fichier.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Importer mes relevés</h2>
      </div>
      <p className="section-help">
        Fichier CSV avec deux colonnes <strong>id;prix</strong>, ou JSON
        avec une table <strong>values</strong>. L’identifiant de chaque
        objet est affiché ci-dessous.
        Pour les exos, ajoute la table JSON <strong>exoCosts</strong> avec les clés <strong>actionPoints</strong> et <strong>movementPoints</strong> : uniquement le supplément, en plus du prix des objets.
      </p>
      <div className="profile-actions">
        <button className="button primary" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Importer des prix
        </button>
        <button
          className="button ghost"
          onClick={() => downloadJson(`prix-${prices.server}.json`, { ...prices, ...effectivePrices })}
        >
          <Download size={14} /> Exporter
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,.tsv"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void importPrices(event.target.files?.[0])}
      />
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <p className="inline-notice">
        Les prix sont enregistrés dans ce navigateur.
        Chaque serveur conserve son propre relevé.
      </p>
    </section>
  );
}
