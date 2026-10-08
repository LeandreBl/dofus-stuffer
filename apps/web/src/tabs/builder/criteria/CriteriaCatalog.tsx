import { useState } from "react";
import { Coins, SlidersHorizontal, Swords } from "lucide-react";
import type { Catalog, Constraint, EquipmentItem, OptimizationRequest } from "@dofus/shared";
import { SearchField } from "../../../components/SearchField";
import { PriceCriteria } from "./PriceCriteria";
import { SpellCriteria } from "./SpellCriteria";
import { StatCriteria } from "./StatCriteria";

type CriteriaType = "stats" | "spells" | "price";
const types = [
  { id: "stats", Icon: SlidersHorizontal, label: "Caractéristiques" },
  { id: "spells", Icon: Swords, label: "Dégâts & critiques" },
  { id: "price", Icon: Coins, label: "Budget" },
] as const;

export function CriteriaCatalog({
  catalog,
  request,
  weapon,
  onAdd,
  onEdit,
}: {
  catalog: Catalog;
  request: OptimizationRequest;
  weapon?: EquipmentItem;
  onAdd: (criterion: Constraint) => void;
  onEdit: (criterion: Constraint) => void;
}) {
  const [type, setType] = useState<CriteriaType>("stats");
  const [search, setSearch] = useState("");
  const [allClasses, setAllClasses] = useState(false);
  const [category, setCategory] = useState("Essentielles");
  const currentClass = catalog.classes.find((entry) => entry.id === request.character.classId);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Ce que je vise</h2>
          <p>Clique sur un critère pour lui donner une cible.</p>
        </div>
        <span className="counter">{catalog.stats.length} caractéristiques</span>
      </div>
      <div className="segment">
        {types.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={type === id ? "active" : ""}
            onClick={() => {
              setType(id);
              setSearch("");
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {type !== "price" && (
        <div className="catalog-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={type === "stats" ? "Rechercher une caractéristique…" : "Rechercher un sort…"}
          />
          {type === "spells" && (
            <button
              className={`button small ${allClasses ? "primary" : "ghost"}`}
              onClick={() => setAllClasses((value) => !value)}
            >
              {allClasses ? "Toutes les classes" : currentClass?.name || "Ma classe"}
            </button>
          )}
        </div>
      )}
      {type === "stats" && <StatCriteria catalog={catalog} constraints={request.constraints} search={search} category={category} onCategory={setCategory} onAdd={onAdd} onEdit={onEdit} />}
      {type === "spells" && <SpellCriteria catalog={catalog} character={request.character} allClasses={allClasses} search={search} weapon={weapon} onAdd={onAdd} />}
      {type === "price" && <PriceCriteria constraints={request.constraints} onAdd={onAdd} onEdit={onEdit} />}
    </section>
  );
}
