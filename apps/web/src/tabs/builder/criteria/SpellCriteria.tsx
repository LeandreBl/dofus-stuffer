import { useMemo, useState } from "react";
import { ChevronRight, Plus, Swords } from "lucide-react";
import { getSpellLevel, hasStatScalingSpellDamage, type Catalog, type Character, type Constraint, type EquipmentItem } from "@dofus/shared";
import { GameImage } from "../../../components/GameImage";
import { searchable, uid } from "../../../lib/format";

export function SpellCriteria({ catalog, character, allClasses, search, weapon, onAdd }: {
  catalog: Catalog;
  character: Character;
  allClasses: boolean;
  search: string;
  weapon?: EquipmentItem;
  onAdd: (criterion: Constraint) => void;
}) {
  const [spellLimit, setSpellLimit] = useState(40);
  const spells = useMemo(
    () =>
      catalog.spells.filter(
        (spell) =>
          hasStatScalingSpellDamage(spell, character.level, catalog) &&
          (allClasses || spell.classIds.includes(character.classId) || spell.classIds.length === 0) &&
          searchable(spell.name).includes(searchable(search)),
      ),
    [catalog, character.classId, character.level, allClasses, search],
  );
  return (
    <>
      <button className="weapon-criterion-card" onClick={() => onAdd({
        id: uid(), kind: "weapon", target: 1000, mode: "critical", metric: "min",
        relation: "atLeast", priority: 0, strict: false,
      })}>
        <span className="weapon-criterion-icon">{weapon?.icon ? <GameImage src={weapon.icon} /> : <Swords size={24} />}</span>
        <span><strong>Dégâts & critiques de l’arme</strong><small>{weapon ? weapon.name : "L’arme de chaque stuff candidat"} · objectifs combinables</small></span>
        <Plus size={17} />
      </button>
      <p className="inline-notice">Seuls les sorts dont les dégâts dépendent de tes caractéristiques sont proposés. Règle leurs dégâts et leur chance de critique, ensemble ou séparément.</p>
      <div className="spell-picker-grid">
        {spells.slice(0, spellLimit).map((spell) => (
          <button
            className="spell-pick"
            key={spell.id}
            onClick={() => onAdd({
              id: uid(),
              kind: "spell",
              spellId: spell.id,
              target: 1000,
              mode: "critical",
              metric: "min",
              turnOffset: 0,
              relation: "atLeast",
              priority: 0,
              strict: false,
            })}
          >
            <GameImage src={spell.icon} />
            <span>{spell.name}</span>
            <small>{getSpellLevel(spell, character.level)?.apCost ?? "—"} PA</small>
          </button>
        ))}
      </div>
      {!spells.length && (
        <div className="empty-state">
          Aucun sort de dégâts disponible pour ce niveau et ces filtres. Essaie avec toutes les classes.
        </div>
      )}
      {spells.length > spellLimit && (
        <button className="button ghost more-button" onClick={() => setSpellLimit((value) => value + 60)}>
          Voir plus de sorts <ChevronRight size={14} />
        </button>
      )}
      <p className="pagination-summary">
        {Math.min(spellLimit, spells.length)} sur {spells.length} sorts ·
        variantes incluses
      </p>
    </>
  );
}
