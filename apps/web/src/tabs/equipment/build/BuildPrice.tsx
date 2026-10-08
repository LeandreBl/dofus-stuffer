import { useMemo } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import { calculateEquipmentPrice, exoPrice, itemPrice, SLOTS, type Build, type Catalog, type EquipmentItem, type PriceBook, type Slot } from '@dofus/shared';
import { GameImage } from "../../../components/GameImage";
import { fmt, money } from "../../../lib/format";

export function BuildPrice({ catalog, build, prices, onPrices, onSlot }: {
  catalog: Catalog;
  build: Build;
  prices: PriceBook;
  onPrices: () => void;
  onSlot: (slot: Slot, item?: EquipmentItem) => void;
}) {
  const entries = useMemo(() => SLOTS.flatMap(slot => {
    const item = catalog.items.find(candidate => candidate.id === build.slots[slot]);
    return item ? [{ slot, item }] : [];
  }), [catalog.items, build.slots]);
  const exos = [...new Set(build.exoBonuses || [])];
  const items = entries.map(entry => entry.item);
  const total = calculateEquipmentPrice(items, exos, { ...prices, mode: 'total' });
  const missing = total.missingPrices.length + total.missingExoPrices.length;
  const hasEquipment = entries.length > 0 || exos.length > 0;
  const amount = (estimate: typeof total) => estimate.cost === null && estimate.knownCost === 0 ? 'À compléter' : `${fmt(estimate.cost ?? estimate.knownCost)} kamas`;
  return <section className="panel build-price" aria-label="Prix estimé de la panoplie">
    <h3><Wallet size={15} /> Prix estimé de la panoplie</h3>
    <span className="build-price-server">{prices.server}</span>
    <div className="build-price-estimate" aria-live="polite">
      <span className="build-price-label">{hasEquipment && missing ? 'Sous-total connu' : 'Coût total · exos compris'}</span>
      <strong className="build-price-total" title={hasEquipment ? `${fmt(total.knownCost)} kamas${missing ? ' connus' : ''}` : undefined}>{hasEquipment ? amount(total) : '—'}</strong>
      {hasEquipment && missing > 0 && <span className="build-price-incomplete">{missing} prix à renseigner</span>}
    </div>
    {hasEquipment ? <>
      <p>{missing ? 'Le total sera disponible quand tous les prix seront connus.' : 'Estimation selon les prix disponibles sur ce serveur.'}</p>
      <details className="build-price-detail">
        <summary>Détail des prix <ChevronRight size={13} /></summary>
        <div className="build-price-items">
          {entries.map(({ slot, item }) => <button key={slot} className="build-price-item" onClick={() => onSlot(slot, item)} aria-label={`Prix de ${item.name} : ${money(itemPrice(prices, item.id))}`}>
            <GameImage src={item.icon} className="build-price-icon" /><span>{item.name}</span><strong title={itemPrice(prices, item.id) === null ? undefined : `${fmt(itemPrice(prices, item.id))} kamas`}>{itemPrice(prices, item.id) === null ? 'Inconnu' : money(itemPrice(prices, item.id))}</strong>
          </button>)}
          {exos.map(exo => <button key={exo} className="build-price-item build-price-exo" onClick={onPrices}>
            <Wallet size={16} /><span>Supplément exo {exo === 'actionPoints' ? 'PA' : 'PM'}</span><strong>{exoPrice(prices, exo) === null ? 'Inconnu' : money(exoPrice(prices, exo))}</strong>
          </button>)}
        </div>
      </details>
    </> : <p>Équipe des objets pour estimer leur coût.</p>}
    <button className="button ghost small wide" onClick={onPrices}>{missing ? 'Compléter les prix' : 'Voir les prix'}<ChevronRight size={13} /></button>
  </section>;
}
