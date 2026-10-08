import { Modal } from "../components/Modal";

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ton atelier, en quelques clics" onClose={onClose}>
      <p>Une recherche se construit autour de ce qui compte pour toi.</p>
      <div className="stats-list">
        <div className="notice">
          <span>1.</span>
          <div>
            <strong>Choisis tes critères.</strong> Caractéristiques, dégâts
            et chance de critique d’un sort, budget : chaque cible se règle au clic.
          </div>
        </div>
        <div className="notice">
          <span>2.</span>
          <div>
            <strong>Classe tes priorités.</strong> Déplace un critère dans
            un autre niveau pour l’associer aux autres. Utilise les flèches
            pour réordonner les niveaux.
          </div>
        </div>
        <div className="notice">
          <span>3.</span>
          <div>
            <strong>Explore les résultats.</strong> Les calculs longs
            continuent sur le serveur. Tes dégâts et statistiques se
            recalculent immédiatement quand tu modifies le stuff.
          </div>
        </div>
      </div>
      <p className="inline-notice">
        Le moteur renvoie le meilleur résultat trouvé, sans preuve
        d’optimalité globale. Les calculs complexes non pris en charge et
        les prix manquants sont signalés.
      </p>
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          C’est parti
        </button>
      </div>
    </Modal>
  );
}
