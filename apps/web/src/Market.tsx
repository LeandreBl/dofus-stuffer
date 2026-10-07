import { useRef, useState } from "react";
import { Coins, Download, Info, Search, Upload } from "lucide-react";
import { type Catalog, type ExoStat, type OptimizationRequest, type PriceBook } from "@dofus/shared";
import { fmt, GameImage, SearchField, StatIcon } from "./ui";
import { parsePriceImport } from "./priceImport";
import type { MaintenanceStatus, PriceSyncState } from "./api";

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Market({
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
  const [search, setSearch] = useState("");
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [limit, setLimit] = useState(24);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const effectiveValues = { ...request.prices.automaticValues, ...request.prices.values };
  const effectiveExoCosts = { ...request.prices.automaticExoCosts, ...request.prices.exoCosts };
  const syncStatus = priceSync.server !== request.prices.server ? "loading"
    : priceSync.configured === false ? "unconfigured" : priceSync.status;
  const hasAutomaticPrices = Object.keys(request.prices.automaticValues || {}).length > 0 || Object.keys(request.prices.automaticExoCosts || {}).length > 0;
  const items = catalog.items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (!onlyKnown || effectiveValues[String(item.id)] !== undefined),
  );
  const changePrices = (changes: Partial<PriceBook>) =>
    onChange({
      ...request,
      prices: {
        ...request.prices,
        ...changes,
        updatedAt: new Date().toISOString(),
      },
    });
  async function importPrices(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("Le fichier dépasse 2 Mo.");
      const content = await file.text();
      const { values: prices, exoCosts } = parsePriceImport(content, file.name.toLowerCase().endsWith(".json") ? "json" : "csv", catalog, request.prices.server);
      changePrices({ values: { ...request.prices.values, ...prices }, exoCosts: { ...request.prices.exoCosts, ...exoCosts } });
      notify(
        `${Object.keys(prices).length + Object.keys(exoCosts).length} prix importés pour ${request.prices.server}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de lire ce fichier.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <>
      <div className="market-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <Coins size={17} /> Mon économie
            </h2>
            <span className="counter">
              {Object.keys(effectiveValues).length} prix d’objets connus
            </span>
          </div>
          <label className="field">
              Serveur
              <select
                value={request.prices.server}
                onChange={(event) => onServer(event.target.value)}
              >
                {Array.from(
                  new Set([request.prices.server, ...catalog.servers]),
                ).map((server) => (
                  <option key={server}>{server}</option>
                ))}
              </select>
          </label>
          <div className="notice">
            <Info size={16} />
            <div>
              {syncStatus === "loading" ? "Vérification des prix de ce serveur…"
                : syncStatus === "available" ? "Les prix disponibles sont synchronisés automatiquement pour ce serveur. Tes prix personnalisés restent prioritaires."
                : syncStatus === "unconfigured" ? "Aucune source de prix automatique n’est configurée. Tu peux renseigner ou importer tes relevés par serveur."
                : "Les prix automatiques sont momentanément indisponibles pour ce serveur."}
              {syncStatus !== "available" && hasAutomaticPrices && " Les derniers prix enregistrés sont conservés."}
              {" "}Un prix inconnu reste inconnu pendant l’optimisation.
            </div>
          </div>
          {request.prices.automaticUpdatedAt && <p className="inline-notice">Dernier relevé automatique : {new Date(request.prices.automaticUpdatedAt).toLocaleString("fr-FR")}{request.prices.automaticSource ? ` · ${request.prices.automaticSource}` : ""}.</p>}
          {priceSync.server === request.prices.server && priceSync.lastCheck?.status === "error" && <p className="inline-notice">La dernière actualisation a échoué. Les derniers prix disponibles restent utilisés.</p>}
          <p className="inline-notice">
            {request.prices.updatedAt
              ? `Dernière modification personnelle : ${new Date(request.prices.updatedAt).toLocaleString("fr-FR")}`
              : "Aucun prix personnalisé pour ce serveur."}{" "}
            · Prix pour les jets maximums du catalogue, auxquels s’ajoutent les suppléments exotiques choisis.
          </p>
        </section>
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
            <button
              className="button primary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> Importer des prix
            </button>
            <button
              className="button ghost"
              onClick={() =>
                downloadJson(
                  `prix-${request.prices.server}.json`,
                  { ...request.prices, values: effectiveValues, exoCosts: effectiveExoCosts },
                )
              }
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
      </div>
      {maintenance && <section className="panel" style={{ marginTop: 23 }}>
        <div className="panel-head"><h2>Mises à jour des données</h2><span className="counter">{maintenance.running ? "Vérification en cours" : maintenance.completedAt ? "Vérification terminée" : "En attente"}</span></div>
        <p className="section-help">Les données et les sources de prix connectées sont vérifiées selon la fréquence prévue sur le serveur. Tes prix personnalisés restent prioritaires.</p>
        <p className="inline-notice">{maintenance.completedAt ? `Dernière vérification : ${new Date(maintenance.completedAt).toLocaleString("fr-FR")}` : maintenance.message || "Première vérification en attente."}</p>
        {(maintenance.catalog || maintenance.prices || maintenance.patch) && <ul className="section-help">
          {maintenance.catalog && <li><strong>Objets et sorts :</strong> {maintenance.catalog.message}</li>}
          {maintenance.prices && <li><strong>Prix :</strong> {maintenance.prices.message}</li>}
          {maintenance.patch && <li><strong>Notes de mise à jour :</strong> {maintenance.patch.message}</li>}
        </ul>}
        {maintenance.latestPatch && <div className="notice"><Info size={16} /><div><strong>{maintenance.latestPatch.title}</strong>{maintenance.latestPatch.publishedAt && <p className="inline-notice">Publié le {new Date(maintenance.latestPatch.publishedAt).toLocaleDateString("fr-FR")}</p>}<p>{maintenance.latestPatch.excerpt}</p><a href={maintenance.latestPatch.url} target="_blank" rel="noreferrer">Lire la note de mise à jour</a></div></div>}
      </section>}
      <section className="panel" style={{ marginTop: 23 }}>
        <div className="panel-head"><div><h2>Budget des exos</h2><p>Un supplément par bonus, sur l’objet de ton choix.</p></div></div>
        <div className="exo-market-grid">
          {(["actionPoints", "movementPoints"] as ExoStat[]).map((exo) => (
            <div className="exo-market-card" key={exo}>
              <h3><StatIcon stat={catalog.stats.find((stat) => stat.key === exo)} /> +1 {exo === "actionPoints" ? "PA" : "PM"} exotique</h3>
              <label className="field">Supplément estimé (kamas)
                <input type="number" min="0" aria-label={`Supplément exo ${exo === "actionPoints" ? "PA" : "PM"} en kamas`} placeholder="Coût inconnu" value={effectiveExoCosts[exo] ?? ""} onChange={(event) => {
                  const exoCosts = { ...request.prices.exoCosts };
                  if (event.target.value === "") delete exoCosts[exo];
                  else exoCosts[exo] = Math.max(0, Number(event.target.value));
                  changePrices({ exoCosts });
                }} />
              </label>
              <p className="inline-notice">{request.prices.exoCosts?.[exo] !== undefined ? "Prix personnalisé" : request.prices.automaticExoCosts?.[exo] !== undefined ? "Prix automatique" : "Aucun prix disponible"}</p>
              {request.prices.exoCosts?.[exo] !== undefined && request.prices.automaticExoCosts?.[exo] !== undefined && <button className="button small ghost" onClick={() => {
                const exoCosts = { ...request.prices.exoCosts };
                delete exoCosts[exo];
                changePrices({ exoCosts });
              }}>Reprendre le prix automatique · {fmt(request.prices.automaticExoCosts[exo])} K</button>}
            </div>
          ))}
        </div>
        <p className="inline-notice">Ces suppléments s’ajoutent une seule fois au prix total du stuff. Effacer un prix personnalisé reprend le prix automatique, s’il est disponible.</p>
      </section>
      <section className="panel" style={{ marginTop: 23 }}>
        <div className="panel-head market-price-head">
          <h2>Prix des objets</h2>
          <button
            className={`button small ${onlyKnown ? "primary" : "ghost"}`}
            onClick={() => {
              setOnlyKnown((value) => !value);
              setLimit(24);
            }}
          >
            {onlyKnown ? "Prix renseignés" : "Tous les objets"}
          </button>
        </div>
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setLimit(24);
          }}
          placeholder="Rechercher un objet pour renseigner son prix…"
        />
        <div className="items-grid">
          {items.slice(0, limit).map((item) => {
            const key = String(item.id);
            const values = request.prices.values;
            return (
            <article className="item-card" key={item.id}>
              <div className="item-card-head">
                <GameImage src={item.icon} />
                <div>
                  <h3>{item.name}</h3>
                  <small>
                    Niv. {item.level} · ID {key}
                  </small>
                </div>
              </div>
              <div className="item-price">
                <input
                  type="number"
                  aria-label={`Prix de ${item.name}`}
                  min="0"
                  placeholder="Prix inconnu"
                  value={effectiveValues[key] ?? ""}
                  onChange={(event) => {
                    const updatedValues = { ...values };
                    if (event.target.value === "")
                      delete updatedValues[key];
                    else
                      updatedValues[key] = Math.max(
                        0,
                        Number(event.target.value),
                      );
                    changePrices({ values: updatedValues });
                  }}
                />
                <span>kamas</span>
              </div>
              <p className="inline-notice">{values[key] !== undefined ? "Prix personnalisé" : request.prices.automaticValues?.[key] !== undefined ? "Prix automatique" : "Aucun prix disponible"}</p>
              {values[key] !== undefined && request.prices.automaticValues?.[key] !== undefined && <button className="button small ghost" onClick={() => {
                const updatedValues = { ...values };
                delete updatedValues[key];
                changePrices({ values: updatedValues });
              }}>Reprendre le prix automatique · {fmt(request.prices.automaticValues[key])} K</button>}
            </article>
          );})}
        </div>
        {!items.length && (
          <div className="empty-state">
            <Search size={23} />
            <p>
              {onlyKnown
                ? "Aucun prix renseigné pour cette recherche."
                : "Aucun objet trouvé."}
            </p>
          </div>
        )}
        {items.length > limit && (
          <button
            className="button ghost more-button"
            onClick={() => setLimit((value) => value + 36)}
          >
            Afficher plus d’objets
          </button>
        )}
        <p className="pagination-summary">
          {Math.min(limit, items.length)} / {fmt(items.length)} objets
        </p>
      </section>
    </>
  );
}
