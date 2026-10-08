import { ChevronRight } from "lucide-react";
import { getSpellLevel, type Catalog, type Element, type Spell, type SpellDamage } from "@dofus/shared";
import { StatIcon } from "../../components/StatIcon";
import { fmt } from "../../lib/format";
import { elementKeys, elementNames, rangeLabel } from "./damage";
import { SpellImage } from "./SpellImage";

export function SpellListRow({ spell, catalog, characterLevel, elements, damage, active, onSelect }: {
  spell: Spell;
  catalog: Catalog;
  characterLevel: number;
  elements: Element[];
  damage?: SpellDamage;
  active: boolean;
  onSelect: () => void;
}) {
  const level = getSpellLevel(spell, characterLevel);
  const critical = catalog.stats.find((stat) => stat.key === "criticalHit");
  return (
    <button className={`spell-list-row ${active ? "active" : ""}`} onClick={onSelect}>
      <SpellImage spell={spell} level={level} catalog={catalog} />
      <span className="spell-list-name">
        <span className="spell-row-title">
          <strong>{spell.name}</strong>
          {!!damage?.critical && (
            <span className="spell-row-crit" title="Chance de coup critique avec ton stuff">
              {fmt(damage.critChance)}%
              <StatIcon stat={critical} />
            </span>
          )}
        </span>
        <small>
          {level?.apCost ?? "—"} PA · niv. {level?.minPlayerLevel ?? "—"}
        </small>
        {!!elements.length && (
          <span className="spell-row-elements" role="img"
            aria-label={`Dégâts ${elements.map((element) => elementNames[element]).join(", ")}`}
            title={elements.map((element) => elementNames[element]).join(" · ")}>
            {elements.map((element) => (
              <StatIcon key={element} stat={catalog.stats.find((stat) => stat.key === elementKeys[element])} />
            ))}
          </span>
        )}
      </span>
      <span className="spell-list-damage">
        {damage?.supported ? (
          <>
            <span>{rangeLabel(damage.normal)}</span>
            <small>
              {damage.critical
                ? <>{rangeLabel(damage.critical)}<StatIcon stat={critical} /></>
                : damage.damageKind === "summon" ? "Invocation · choisir l’attaque" : damage.normal.max === 0 && elements.length && (damage.scenarioOptions?.length || damage.castSources?.length || damage.parameters?.includes("runes")) ? "Choisir la situation" : damage.damageKind === "support" ? "Sort de soutien" : "Sans critique"}
            </small>
          </>
        ) : (
          <>
            <span>Effets à vérifier</span>
            <small>Calcul partiel</small>
          </>
        )}
      </span>
      <ChevronRight size={12} />
    </button>
  );
}
