import { Info } from "lucide-react";
import type { MaintenanceStatus } from "../../lib/api";

export function MaintenancePanel({ maintenance }: { maintenance: MaintenanceStatus }) {
  return (
    <section className="panel" style={{ marginTop: 23 }}>
      <div className="panel-head"><h2>Mises à jour des données</h2><span className="counter">{maintenance.running ? "Vérification en cours" : maintenance.completedAt ? "Vérification terminée" : "En attente"}</span></div>
      <p className="section-help">Les données et les sources de prix connectées sont vérifiées selon la fréquence prévue sur le serveur. Tes prix personnalisés restent prioritaires.</p>
      <p className="inline-notice">{maintenance.completedAt ? `Dernière vérification : ${new Date(maintenance.completedAt).toLocaleString("fr-FR")}` : maintenance.message || "Première vérification en attente."}</p>
      {(maintenance.catalog || maintenance.prices || maintenance.patch) && <ul className="section-help">
        {maintenance.catalog && <li><strong>Objets et sorts :</strong> {maintenance.catalog.message}</li>}
        {maintenance.prices && <li><strong>Prix :</strong> {maintenance.prices.message}</li>}
        {maintenance.patch && <li><strong>Notes de mise à jour :</strong> {maintenance.patch.message}</li>}
      </ul>}
      {maintenance.latestPatch && <div className="notice"><Info size={16} /><div><strong>{maintenance.latestPatch.title}</strong>{maintenance.latestPatch.publishedAt && <p className="inline-notice">Publié le {new Date(maintenance.latestPatch.publishedAt).toLocaleDateString("fr-FR")}</p>}<p>{maintenance.latestPatch.excerpt}</p><a href={maintenance.latestPatch.url} target="_blank" rel="noreferrer">Lire la note de mise à jour</a></div></div>}
    </section>
  );
}
