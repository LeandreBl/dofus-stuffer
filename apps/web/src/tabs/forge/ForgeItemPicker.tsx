import { useMemo, useState } from "react";
import type { Catalog, EquipmentItem } from "@dofus/shared";
import { GameImage } from "../../components/GameImage";
import { SearchField } from "../../components/SearchField";
import { searchable } from "../../lib/format";

export function ForgeItemPicker({ catalog, onPick }: { catalog: Catalog; onPick: (item: EquipmentItem) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const text = searchable(query.trim());
    if (!text) return [];
    return catalog.items
      .filter((item) => item.forgeable && searchable(item.name).includes(text))
      .sort((a, b) => Number(searchable(b.name).startsWith(text)) - Number(searchable(a.name).startsWith(text)) || b.level - a.level)
      .slice(0, 8);
  }, [catalog, query]);
  return (
    <div className="forge-picker">
      <SearchField value={query} onChange={setQuery} placeholder="Cherche l’objet à forgemager" />
      {matches.length > 0 && (
        <div className="forge-picker-list">
          {matches.map((item) => (
            <button key={item.id} onClick={() => { setQuery(""); onPick(item); }}>
              <GameImage src={item.icon} />
              <span><strong>{item.name}</strong><small>Niv. {item.level} · {item.typeName}</small></span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && !matches.length && <p className="inline-notice">Aucun objet forgemageable ne correspond.</p>}
    </div>
  );
}
