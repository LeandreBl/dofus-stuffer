import type { Catalog, Stats } from "@dofus/shared";
import { StatIcon } from "../../../components/StatIcon";
import { fmt, statUnit } from "../../../lib/format";

const bonusNames: Record<string, string> = { dealtDamageMultiplier: "dommages finaux", dealtDamageMultiplierMelee: "dommages en mêlée",
  dealtDamageMultiplierDistance: "dommages à distance", dealtDamageMultiplierWeapon: "dommages d’armes", dealtDamageMultiplierSpells: "dommages de sorts", weaponPower: "Puissance Armes" };
export function BonusList({ stats, catalog }: { stats: Stats; catalog: Catalog }) {
  return <div className="combat-bonus-list">{Object.entries(stats).filter(([, value]) => value !== 0).map(([key, value]) => {
    const stat = catalog.stats.find(stat => stat.key === key);
    return <span key={key}><StatIcon stat={stat} />{value > 0 ? "+" : ""}{fmt(value)}{statUnit(stat) ? ` ${statUnit(stat)}` : ""} {bonusNames[key] || stat?.name || key}</span>;
  })}</div>;
}
